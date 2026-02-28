"""Repository for ``test_sessions`` and ``test_results`` tables.

Provides a transactional method that creates a session and its
associated result rows in one logical operation.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from core.exceptions import DatabaseError, RecordNotFoundError

if TYPE_CHECKING:
    from supabase import AsyncClient

logger = logging.getLogger(__name__)


class TestResultRepository:
    """Stateless repository — ``AsyncClient`` injected per call."""

    async def create_session_with_results(
        self,
        client: AsyncClient,
        *,
        user_id: str,
        test_date: str,
        lab_name: str | None = None,
        notes: str | None = None,
        source: str = "manual",
        results: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Insert a test session and its results in bulk.

        Steps:
            1. Verify that the user profile exists.
            2. Insert a new ``test_sessions`` row.
            3. Bulk-insert all ``test_results`` rows linked
               to the generated session ``id``.

        Args:
            client: Supabase async client.
            user_id: UUID string of the user.
            test_date: ISO date string (``YYYY-MM-DD``).
            lab_name: Optional laboratory name.
            notes: Optional notes.
            source: Data entry source (manual, ocr_upload,
                api_integration).
            results: List of dicts, each with ``biomarker_id``,
                ``value``, ``unit``, and optionally ``notes``.

        Returns:
            Dict with ``session`` (row) and ``results`` (list
            of rows).

        Raises:
            RecordNotFoundError: If the user profile does not exist.
            DatabaseError: On insert failures (e.g. invalid FK).
        """
        # ── Guard: profile must exist ────────────────────────────
        await self._ensure_profile_exists(client, user_id)

        # ── 1. Create session ────────────────────────────────────
        session_payload: dict[str, Any] = {
            "user_id": user_id,
            "test_date": test_date,
            "status": "completed",
        }
        if lab_name is not None:
            session_payload["lab_name"] = lab_name
        if notes is not None:
            session_payload["notes"] = notes

        try:
            session_resp = (
                await client.table("test_sessions").insert(session_payload).execute()
            )
        except Exception as exc:
            raise DatabaseError(f"Failed to create test session: {exc}") from exc

        if not session_resp.data:
            raise DatabaseError("Session insert returned no data")

        session_row = session_resp.data[0]
        session_id: int = session_row["id"]
        logger.info(
            "Created test_session id=%d for user %s",
            session_id,
            user_id,
        )

        # ── 2. Bulk-insert results ───────────────────────────────
        result_rows: list[dict[str, Any]] = [
            {
                "user_id": user_id,
                "biomarker_id": r["biomarker_id"],
                "session_id": session_id,
                "value": str(r["value"]),
                "unit": r["unit"],
                "test_date": test_date,
                "lab_name": lab_name,
                "source": source,
                "notes": r.get("notes"),
            }
            for r in results
        ]

        try:
            results_resp = (
                await client.table("test_results").insert(result_rows).execute()
            )
        except Exception as exc:
            # Attempt to roll back the session row.
            await self._rollback_session(client, session_id)
            raise DatabaseError(f"Failed to insert test results: {exc}") from exc

        saved_results = results_resp.data or []
        logger.info(
            "Inserted %d test_results for session %d",
            len(saved_results),
            session_id,
        )

        return {
            "session": session_row,
            "results": saved_results,
        }

    # ── Helpers ──────────────────────────────────────────────────

    @staticmethod
    async def _ensure_profile_exists(
        client: AsyncClient,
        user_id: str,
    ) -> None:
        """Raise ``RecordNotFoundError`` if profile is absent."""
        try:
            resp = (
                await client.table("profiles")
                .select("id")
                .eq("id", user_id)
                .maybe_single()
                .execute()
            )
        except Exception as exc:
            raise DatabaseError(f"Profile lookup failed: {exc}") from exc

        if resp.data is None:
            raise RecordNotFoundError(
                table="profiles",
                identifier=user_id,
            )

    @staticmethod
    async def _rollback_session(
        client: AsyncClient,
        session_id: int,
    ) -> None:
        """Best-effort removal of a session row on failure."""
        try:
            await client.table("test_sessions").delete().eq("id", session_id).execute()
            logger.warning("Rolled back test_session id=%d", session_id)
        except Exception:
            logger.warning(
                "Could not roll back test_session id=%d",
                session_id,
            )


# ── Module-level singleton ───────────────────────────────────────────
test_result_repository = TestResultRepository()
