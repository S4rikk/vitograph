"""Standalone connection test for the remote Supabase project.

Run this script after filling in ``.env`` with real credentials::

    cd apps/api
    python test_db.py

A successful run prints a confirmation message and exits with
code 0.  Any connection or query error is printed to stderr
and exits with code 1.
"""

from __future__ import annotations

import asyncio
import logging
import sys

from core.config import settings
from core.database import SupabaseClientManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


async def verify_connection() -> None:
    """Create an async Supabase client and run a smoke test.

    Steps:
        1. Validate that env vars are not placeholders.
        2. Initialise the async client.
        3. Attempt a lightweight query on the ``profiles`` table.
        4. Print results and close the client.
    """
    # ── Guard: ensure credentials are real ───────────────────────
    url = settings.supabase_url
    key = settings.supabase_key

    if "YOUR_PROJECT_REF" in url or "your-" in key:
        logger.error(
            "Credentials are still placeholder values! "
            "Edit .env with real Supabase keys before running."
        )
        sys.exit(1)

    logger.info("SUPABASE_URL  = %s", url)
    logger.info("SUPABASE_KEY  = %s...%s", key[:8], key[-4:])

    # ── Connect ──────────────────────────────────────────────────
    manager = SupabaseClientManager()

    try:
        client = await manager.get_client()
        logger.info("✅ Supabase async client initialised")
    except Exception:
        logger.exception("❌ Failed to create Supabase client")
        sys.exit(1)

    # ── Smoke query ──────────────────────────────────────────────
    try:
        response = (
            await client.table("profiles")
            .select("id", count="exact")
            .limit(0)
            .execute()
        )
        count = response.count if response.count is not None else 0
        logger.info(
            "✅ Query succeeded — profiles table has %d row(s)",
            count,
        )
    except Exception:
        logger.exception(
            "❌ Query failed — have you run the migration SQL "
            "in the Supabase Dashboard SQL Editor?"
        )
        sys.exit(1)
    finally:
        await manager.close()

    logger.info("🎉 Connection test passed!")


if __name__ == "__main__":
    asyncio.run(verify_connection())
