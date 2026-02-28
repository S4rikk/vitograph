"""Standalone test for the Dynamic Norm Engine.

Creates a temporary auth user, dummy data (profile, biomarker,
rule), runs the engine, prints results, then cleans everything up.

Uses ``SUPABASE_SERVICE_ROLE_KEY`` to bypass RLS and access
``auth.admin`` methods.  The main API client (``core/database.py``)
is NOT modified — production remains RLS-protected.

Usage::

    cd apps/api
    python test_engine.py

Prerequisites:
    • ``.env`` filled with **all three** Supabase credentials.
    • Migration ``00001_initial_schema.sql`` applied in Supabase
      SQL Editor so the tables exist.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
import uuid

from core.config import settings
from services.dynamic_norm_service import DynamicNormEngine
from supabase import AsyncClient, create_async_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


# ── Test data ────────────────────────────────────────────────────────

# Randomised email to avoid collisions with previous crashed runs.
_RANDOM_SUFFIX = uuid.uuid4().hex[:8]
TEST_EMAIL = f"test_engine_{_RANDOM_SUFFIX}@vitograph-test.local"
TEST_PASSWORD = "TestEngine!Pass_42"  # noqa: S105
TEST_BIOMARKER_CODE = "_test_magnesium"


async def _create_admin_client() -> AsyncClient:
    """Create an async Supabase client with the service-role key.

    Raises:
        SystemExit: If credentials are missing or placeholders.
    """
    url = settings.supabase_url
    service_key = settings.supabase_service_role_key

    if "YOUR_PROJECT_REF" in url:
        logger.error("❌ SUPABASE_URL is still a placeholder! Edit .env first.")
        sys.exit(1)

    if not service_key or "your-" in service_key:
        logger.error(
            "❌ SUPABASE_SERVICE_ROLE_KEY is missing or "
            "still a placeholder!\n"
            "   Add it to .env (Supabase Dashboard → Settings "
            "→ API → service_role key)."
        )
        sys.exit(1)

    logger.info("SUPABASE_URL  = %s", url)
    logger.info(
        "SERVICE_KEY   = %s...%s",
        service_key[:8],
        service_key[-4:],
    )

    return await create_async_client(url, service_key)


async def _create_auth_user(
    client: AsyncClient,
) -> str:
    """Create a temporary user in ``auth.users`` via admin API.

    Uses a randomised email so re-runs never collide.

    Args:
        client: Admin-level Supabase client.

    Returns:
        The real UUID string of the created auth user.
    """
    logger.info("Creating auth user: %s", TEST_EMAIL)

    response = await client.auth.admin.create_user(
        {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "email_confirm": True,
        }
    )

    user_id: str = response.user.id
    logger.info("✅ Auth user created (id=%s)", user_id)
    return user_id


async def _delete_auth_user(
    client: AsyncClient,
    user_id: str,
) -> None:
    """Delete the temporary auth user during cleanup.

    Args:
        client: Admin-level Supabase client.
        user_id: UUID string of the auth user to remove.
    """
    try:
        await client.auth.admin.delete_user(user_id)
        logger.info("✅ Auth user %s deleted", user_id)
    except Exception:
        logger.warning(
            "⚠️  Could not delete auth user %s — remove manually in Supabase Dashboard.",
            user_id,
        )


async def _cleanup(
    client: AsyncClient,
    user_id: str,
) -> None:
    """Remove test artefacts from the database.

    Args:
        client: Admin-level async client (service-role key).
        user_id: UUID string of the test user.
    """
    # Delete in dependency order to respect FK constraints.
    await client.table("user_dynamic_norms").delete().eq("user_id", user_id).execute()
    await (
        client.table("dynamic_norm_rules").delete().eq("factor_value", "high").execute()
    )
    await client.table("test_results").delete().eq("user_id", user_id).execute()
    await client.table("biomarkers").delete().eq("code", TEST_BIOMARKER_CODE).execute()
    await client.table("profiles").delete().eq("id", user_id).execute()
    logger.info("🧹 Cleaned up test rows")

    # Delete auth user last (profile FK cascades anyway).
    await _delete_auth_user(client, user_id)


async def run_engine_test() -> None:
    """Full integration test for DynamicNormEngine.

    Scenario:
        • Create a real auth user → get UUID
        • Insert profile with stress_level = high
        • Insert Magnesium biomarker: 1.7 – 2.2 mg/dL
        • Insert rule: stress=high → percentage +20% shift
        • Expected result:
            • low  = 1.7 + 1.7 × 0.20 = 2.040
            • high = 2.2 + 2.2 × 0.20 = 2.640
    """
    client: AsyncClient | None = None
    user_id: str | None = None
    engine = DynamicNormEngine()

    try:
        # ── Admin client ────────────────────────────────────────
        client = await _create_admin_client()
        logger.info("✅ Admin Supabase client initialised")

        # ── 0. Create auth user (satisfies FK on profiles) ──────
        user_id = await _create_auth_user(client)
        user_uuid = uuid.UUID(user_id)

        # ── 1. Insert dummy profile ─────────────────────────────
        await (
            client.table("profiles")
            .insert(
                {
                    "id": user_id,
                    "display_name": "Test User (engine)",
                    "stress_level": "high",
                    "activity_level": "moderate",
                    "biological_sex": "male",
                }
            )
            .execute()
        )
        logger.info("✅ Inserted test profile %s", user_id)

        # ── 2. Insert dummy biomarker ───────────────────────────
        bio_response = (
            await client.table("biomarkers")
            .upsert(
                {
                    "code": TEST_BIOMARKER_CODE,
                    "name_en": "Magnesium (Test)",
                    "name_ru": "Магний (Тест)",
                    "category": "mineral",
                    "unit": "mg/dL",
                    "ref_range_low": "1.700",
                    "ref_range_high": "2.200",
                    "is_active": True,
                },
                on_conflict="code",
            )
            .execute()
        )
        biomarker_id: int = bio_response.data[0]["id"]
        logger.info("✅ Inserted test biomarker (id=%d)", biomarker_id)

        # ── 3. Insert dummy rule ────────────────────────────────
        await (
            client.table("dynamic_norm_rules")
            .insert(
                {
                    "biomarker_id": biomarker_id,
                    "factor_type": "stress_level",
                    "factor_value": "high",
                    "adjustment_type": "percentage",
                    "operation": "add",
                    "adjustment_value": "0",
                    "low_adjustment": "20.000",
                    "high_adjustment": "20.000",
                    "priority": 1,
                    "rationale": (
                        "High stress depletes magnesium; "
                        "increase reference range by 20%."
                    ),
                    "is_active": True,
                }
            )
            .execute()
        )
        logger.info("✅ Inserted test rule (stress→Mg +20%%)")

        # ── 4. Run the engine ───────────────────────────────────
        results = await engine.calculate_dynamic_norms(client, user_uuid)

        logger.info("=" * 60)
        logger.info("ENGINE RESULTS")
        logger.info("=" * 60)

        for norm in results:
            logger.info(
                "  biomarker_id=%s  low=%s  high=%s",
                norm.get("biomarker_id"),
                norm.get("computed_low"),
                norm.get("computed_high"),
            )
            rules_applied = norm.get("applied_rules", [])
            if rules_applied:
                logger.info(
                    "  applied_rules=%s",
                    json.dumps(rules_applied, indent=2),
                )

        logger.info("=" * 60)
        logger.info("🎉 Dynamic Norm Engine test passed!")

    except Exception:
        logger.exception("❌ Engine test failed")
        sys.exit(1)
    finally:
        if client is not None and user_id is not None:
            try:
                await _cleanup(client, user_id)
            except Exception:
                logger.warning(
                    "⚠️  Cleanup failed — remove test rows and auth user manually."
                )
            try:
                await client.auth.sign_out()
            except Exception:  # noqa: BLE001
                pass


if __name__ == "__main__":
    asyncio.run(run_engine_test())
