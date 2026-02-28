"""Analysis Service — compares test results to dynamic norms.

Provides the core logic for determining whether a user's actual
biomarker values fall within, below, or above their personalised
reference ranges.

Status classification
---------------------

+---------------------------------------------------------------+
| Condition                          | Status                    |
+====================================+===========================+
| No dynamic norm exists             | ``no_norm``               |
+------------------------------------+---------------------------+
| value < norm_low                   | ``low``                   |
+------------------------------------+---------------------------+
| value < norm_low × 0.80           | ``critical_low``          |
|  (>20% below lower bound)         |                           |
+------------------------------------+---------------------------+
| value > norm_high                  | ``high``                  |
+------------------------------------+---------------------------+
| value > norm_high × 1.20          | ``critical_high``         |
|  (>20% above upper bound)         |                           |
+------------------------------------+---------------------------+
| norm_low ≤ value ≤ norm_high      | ``optimal``               |
+------------------------------------+---------------------------+

Variance percentage
-------------------

``variance_pct`` shows how far the actual value deviates from the
nearest bound:

* **Within range** → ``0``
* **Below low** → ``(value − low) / low × 100``  (negative)
* **Above high** → ``(value − high) / high × 100``  (positive)
"""

from __future__ import annotations

import datetime
import logging
from decimal import ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING, Any

from core.exceptions import DatabaseError, RecordNotFoundError
from schemas.analysis_schema import (
    AnalyzedBiomarkerItem,
    BiomarkerStatus,
    SessionAnalysisResponse,
)
from services.dynamic_norm_service import DynamicNormEngine

if TYPE_CHECKING:
    import uuid

    from supabase import AsyncClient

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────

_ZERO = Decimal("0")
_HUNDRED = Decimal("100")
_CRITICAL_THRESHOLD = Decimal("0.20")  # 20 %
_QUANTIZE_SPEC = Decimal("0.01")


class AnalysisService:
    """Compares actual test results against personalised norms.

    The service is **stateless** — the ``AsyncClient`` is passed
    into every public method.
    """

    def __init__(self) -> None:
        self._engine = DynamicNormEngine()

    # ── Public API ───────────────────────────────────────────────

    async def analyze_session(
        self,
        client: AsyncClient,
        user_id: uuid.UUID,
        session_id: int,
    ) -> SessionAnalysisResponse:
        """Analyse a test session against the user's dynamic norms.

        Steps:
            1. Ensure dynamic norms are up-to-date by running the
               engine.
            2. Fetch the user's cached norms from
               ``user_dynamic_norms``.
            3. Fetch the test results for the given session.
            4. Compare each result to its personalised norm.
            5. Return a structured analysis response.

        Args:
            client: Supabase async client.
            user_id: UUID of the user profile.
            session_id: PK of the test session to analyse.

        Returns:
            ``SessionAnalysisResponse`` with per-biomarker status
            and a summary breakdown.

        Raises:
            RecordNotFoundError: If the session does not exist.
            DatabaseError: On unexpected database failures.
        """
        # 1 — Refresh norms (idempotent upsert)
        await self._engine.calculate_dynamic_norms(client, user_id)
        logger.info("Dynamic norms refreshed for user %s", user_id)

        # 2 — Fetch norms keyed by biomarker_id
        norms_map = await self._fetch_norms_map(client, str(user_id))

        # 3 — Fetch session + results
        session_row = await self._fetch_session(client, str(user_id), session_id)
        results = await self._fetch_session_results(client, session_id)

        # 4 — Fetch biomarker metadata for enrichment
        biomarker_map = await self._fetch_biomarker_map(client)

        # 5 — Classify each result
        items: list[AnalyzedBiomarkerItem] = []
        for result in results:
            bio_id: int = result["biomarker_id"]
            actual = Decimal(str(result["value"]))
            unit: str = result["unit"]

            norm = norms_map.get(bio_id)
            bio_meta = biomarker_map.get(bio_id, {})

            if norm is None:
                items.append(
                    AnalyzedBiomarkerItem(
                        biomarker_id=bio_id,
                        biomarker_code=bio_meta.get("code", ""),
                        biomarker_name=bio_meta.get("name_en", ""),
                        unit=unit,
                        actual_value=actual,
                        status="no_norm",
                    )
                )
                continue

            low = Decimal(str(norm["computed_low"]))
            high = Decimal(str(norm["computed_high"]))
            status, variance = self._classify(actual, low, high)

            items.append(
                AnalyzedBiomarkerItem(
                    biomarker_id=bio_id,
                    biomarker_code=bio_meta.get("code", ""),
                    biomarker_name=bio_meta.get("name_en", ""),
                    unit=unit,
                    actual_value=actual,
                    norm_low=low,
                    norm_high=high,
                    status=status,
                    variance_pct=variance,
                )
            )

        # 6 — Build summary counts
        summary: dict[str, int] = {}
        for item in items:
            summary[item.status] = summary.get(item.status, 0) + 1

        test_date = datetime.date.fromisoformat(str(session_row["test_date"]))

        return SessionAnalysisResponse(
            user_id=user_id,
            session_id=session_id,
            test_date=test_date,
            analyzed_at=datetime.datetime.now(tz=datetime.UTC),
            total_biomarkers=len(items),
            summary=summary,
            items=items,
        )

    # ── Classification logic (pure, no I/O) ──────────────────────

    @staticmethod
    def _classify(
        value: Decimal,
        low: Decimal,
        high: Decimal,
    ) -> tuple[BiomarkerStatus, Decimal]:
        """Classify a biomarker value against norm bounds.

        Classification rules:
            • ``value < low × (1 − 0.20)`` → ``critical_low``
            • ``value < low``               → ``low``
            • ``value > high × (1 + 0.20)`` → ``critical_high``
            • ``value > high``              → ``high``
            • otherwise                      → ``optimal``

        Variance percentage:
            • Within range → ``0``
            • Below ``low`` → ``(value − low) / low × 100``
              (negative number)
            • Above ``high`` → ``(value − high) / high × 100``
              (positive number)

        Args:
            value: The actual measured value.
            low: Personalized lower bound.
            high: Personalized upper bound.

        Returns:
            Tuple of ``(status, variance_pct)``.
        """
        # Guard: avoid division by zero for edge-case norms.
        if low <= _ZERO and high <= _ZERO:
            return "optimal", _ZERO

        if value < low:
            variance = (value - low) / low * _HUNDRED if low > _ZERO else _ZERO
            variance = variance.quantize(_QUANTIZE_SPEC, rounding=ROUND_HALF_UP)

            # Critical: more than 20% below the lower bound.
            critical_boundary = low * (1 - _CRITICAL_THRESHOLD)
            if value < critical_boundary:
                return "critical_low", variance
            return "low", variance

        if value > high:
            variance = (value - high) / high * _HUNDRED if high > _ZERO else _ZERO
            variance = variance.quantize(_QUANTIZE_SPEC, rounding=ROUND_HALF_UP)

            # Critical: more than 20% above the upper bound.
            critical_boundary = high * (1 + _CRITICAL_THRESHOLD)
            if value > critical_boundary:
                return "critical_high", variance
            return "high", variance

        return "optimal", _ZERO

    # ── Data fetching (private) ──────────────────────────────────

    @staticmethod
    async def _fetch_norms_map(
        client: AsyncClient,
        user_id: str,
    ) -> dict[int, dict[str, Any]]:
        """Fetch all cached norms for a user, keyed by biomarker_id.

        Args:
            client: Supabase async client.
            user_id: UUID string.

        Returns:
            Dict mapping ``biomarker_id`` → norm row dict.
        """
        try:
            resp = (
                await client.table("user_dynamic_norms")
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )
        except Exception as exc:
            raise DatabaseError(f"Failed to fetch norms for {user_id}: {exc}") from exc

        return {row["biomarker_id"]: row for row in (resp.data or [])}

    @staticmethod
    async def _fetch_session(
        client: AsyncClient,
        user_id: str,
        session_id: int,
    ) -> dict[str, Any]:
        """Fetch a test session, ensuring it belongs to the user.

        Raises:
            RecordNotFoundError: If session does not exist or
                belongs to another user.
        """
        try:
            resp = (
                await client.table("test_sessions")
                .select("*")
                .eq("id", session_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
        except Exception as exc:
            raise DatabaseError(f"Failed to fetch session {session_id}: {exc}") from exc

        if resp.data is None:
            raise RecordNotFoundError(
                table="test_sessions",
                identifier=str(session_id),
            )
        return resp.data

    @staticmethod
    async def _fetch_session_results(
        client: AsyncClient,
        session_id: int,
    ) -> list[dict[str, Any]]:
        """Fetch all test_results rows for a given session.

        Args:
            client: Supabase async client.
            session_id: PK of the test session.

        Returns:
            List of result row dicts.
        """
        try:
            resp = (
                await client.table("test_results")
                .select("*")
                .eq("session_id", session_id)
                .execute()
            )
        except Exception as exc:
            raise DatabaseError(
                f"Failed to fetch results for session {session_id}: {exc}"
            ) from exc
        return resp.data or []

    @staticmethod
    async def _fetch_biomarker_map(
        client: AsyncClient,
    ) -> dict[int, dict[str, Any]]:
        """Fetch all biomarkers keyed by id for metadata enrichment.

        Returns:
            Dict mapping ``id`` → biomarker row dict.
        """
        try:
            resp = (
                await client.table("biomarkers")
                .select("id, code, name_en, unit")
                .eq("is_active", True)
                .execute()
            )
        except Exception as exc:
            raise DatabaseError(f"Failed to fetch biomarkers: {exc}") from exc

        return {row["id"]: row for row in (resp.data or [])}


# ── Module-level singleton ───────────────────────────────────────────
analysis_service = AnalysisService()
