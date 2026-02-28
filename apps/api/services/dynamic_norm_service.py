"""Dynamic Norm Engine — core IP of the VITOGRAPH platform.

Calculates personalized biomarker reference ranges by applying
lifestyle- and environment-based adjustment rules to standard
reference ranges.

Algorithm
---------
1. Fetch user profile → extract lifestyle factors.
2. Fetch all active biomarkers.
3. For each biomarker, query ``dynamic_norm_rules`` for matching
   factor/value pairs from the user's profile.
4. Sort matching rules by ``priority`` ascending (highest last so
   they win on conflict).
5. Apply each rule sequentially:

   ``adjustment_type``
       - ``absolute``   — ``bound += low/high_adjustment``
       - ``percentage``  — ``bound += bound × (low/high_adjustment / 100)``
       - ``override``    — ``bound = low/high_adjustment``

   ``operation`` + ``adjustment_value`` (applied **after** the
   per-bound shift above):
       - ``add``         — ``bound += adjustment_value``
       - ``multiply``    — ``bound *= adjustment_value``
       - ``percentage``  — ``bound += bound × (adjustment_value / 100)``

6. Clamp final range: ``low ≥ 0`` and ``high ≥ low``.
7. Upsert result into ``user_dynamic_norms`` cache table.
"""

from __future__ import annotations

import logging
import uuid
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from core.exceptions import DatabaseError, RecordNotFoundError

if TYPE_CHECKING:
    from supabase import AsyncClient

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────

_ZERO = Decimal("0")
_HUNDRED = Decimal("100")

# Profile fields that can act as rule factors
_FACTOR_FIELDS: tuple[str, ...] = (
    "biological_sex",
    "activity_level",
    "stress_level",
    "climate_zone",
    "sun_exposure",
    "diet_type",
    "alcohol_frequency",
    "pregnancy_status",
    "is_smoker",
)


class DynamicNormEngine:
    """Computes personalised biomarker ranges for a single user.

    The engine is **stateless** — the Supabase ``AsyncClient`` is
    passed into every public method.  This makes it trivially
    testable and compatible with FastAPI dependency injection.
    """

    # ── Public API ───────────────────────────────────────────────

    async def calculate_dynamic_norms(
        self,
        client: AsyncClient,
        user_id: uuid.UUID,
    ) -> list[dict[str, Any]]:
        """Run the full norm calculation pipeline for *user_id*.

        Steps:
            1. Fetch profile and extract factors.
            2. Fetch all active biomarkers.
            3. For each biomarker, find and apply matching rules.
            4. Upsert computed norms into the cache table.

        Args:
            client: Supabase async client.
            user_id: UUID of the target user profile.

        Returns:
            List of dicts with ``biomarker_id``, ``computed_low``,
            ``computed_high``, and ``applied_rules`` for every
            biomarker that was processed.

        Raises:
            RecordNotFoundError: If the user profile does not exist.
            DatabaseError: On any database failure.
        """
        # 1 — Profile & factors
        profile = await self._fetch_profile(client, user_id)
        factors = self._extract_factors(profile)
        logger.info("Extracted %d factors for user %s", len(factors), user_id)

        # 2 — Biomarkers
        biomarkers = await self._fetch_active_biomarkers(client)
        logger.info("Processing %d active biomarkers", len(biomarkers))

        results: list[dict[str, Any]] = []

        for biomarker in biomarkers:
            bio_id: int = biomarker["id"]
            ref_low = Decimal(str(biomarker.get("ref_range_low") or 0))
            ref_high = Decimal(str(biomarker.get("ref_range_high") or 0))

            # 3 — Matching rules
            rules = await self._fetch_matching_rules(client, bio_id, factors)

            # 4 — Apply adjustments
            computed_low, computed_high, applied = self._apply_rules(
                ref_low, ref_high, rules
            )

            # 5 — Upsert into cache
            norm_record = await self._upsert_norm(
                client,
                user_id=user_id,
                biomarker_id=bio_id,
                computed_low=computed_low,
                computed_high=computed_high,
                applied_rules=applied,
            )
            results.append(norm_record)

        logger.info(
            "Computed %d dynamic norms for user %s",
            len(results),
            user_id,
        )
        return results

    # ── Data fetching (private) ──────────────────────────────────

    async def _fetch_profile(
        self,
        client: AsyncClient,
        user_id: uuid.UUID,
    ) -> dict[str, Any]:
        """Fetch a single user profile row.

        Raises:
            RecordNotFoundError: If the profile does not exist.
        """
        try:
            response = (
                await client.table("profiles")
                .select("*")
                .eq("id", str(user_id))
                .maybe_single()
                .execute()
            )
        except Exception as exc:
            raise DatabaseError(f"Failed to fetch profile {user_id}: {exc}") from exc

        if response.data is None:
            raise RecordNotFoundError(
                table="profiles",
                identifier=str(user_id),
            )
        return response.data

    async def _fetch_active_biomarkers(
        self,
        client: AsyncClient,
    ) -> list[dict[str, Any]]:
        """Fetch all biomarkers where ``is_active`` is true."""
        try:
            response = (
                await client.table("biomarkers")
                .select("*")
                .eq("is_active", True)
                .execute()
            )
        except Exception as exc:
            raise DatabaseError(f"Failed to fetch biomarkers: {exc}") from exc
        return response.data or []

    async def _fetch_matching_rules(
        self,
        client: AsyncClient,
        biomarker_id: int,
        factors: dict[str, str],
    ) -> list[dict[str, Any]]:
        """Fetch active rules matching any of the user's factors.

        Queries ``dynamic_norm_rules`` for rows where
        ``(biomarker_id, factor_type, factor_value)`` matches one
        of the user's profile factors.  Results are sorted by
        ``priority ASC`` so the highest-priority rule is applied
        last and therefore wins on conflict.

        Args:
            client: Supabase async client.
            biomarker_id: The biomarker to fetch rules for.
            factors: Dict of ``{factor_type: factor_value}``
                extracted from the user profile.

        Returns:
            List of rule dicts sorted by priority ascending.
        """
        if not factors:
            return []

        all_rules: list[dict[str, Any]] = []

        for factor_type, factor_value in factors.items():
            try:
                response = (
                    await client.table("dynamic_norm_rules")
                    .select("*")
                    .eq("biomarker_id", biomarker_id)
                    .eq("factor_type", factor_type)
                    .eq("factor_value", factor_value)
                    .eq("is_active", True)
                    .order("priority", desc=False)
                    .execute()
                )
                if response.data:
                    all_rules.extend(response.data)
            except Exception as exc:
                logger.warning(
                    "Rule query failed for biomarker=%d factor=%s/%s: %s",
                    biomarker_id,
                    factor_type,
                    factor_value,
                    exc,
                )

        # Re-sort combined results by priority ascending.
        all_rules.sort(key=lambda r: r.get("priority", 0))
        return all_rules

    # ── Adjustment logic (pure, no I/O) ──────────────────────────

    @staticmethod
    def _extract_factors(
        profile: dict[str, Any],
    ) -> dict[str, str]:
        """Pull factor-type → factor-value pairs from a profile.

        Only factors that have a non-null value are included.
        Boolean ``is_smoker`` is converted to ``"true"``/``"false"``.

        Args:
            profile: Raw profile dict from the database.

        Returns:
            Dict mapping factor type names to their string values.
        """
        factors: dict[str, str] = {}
        for field in _FACTOR_FIELDS:
            value = profile.get(field)
            if value is None:
                continue
            # is_smoker is boolean; convert to text for rule matching.
            if isinstance(value, bool):
                value = str(value).lower()
            factors[field] = str(value)
        return factors

    @staticmethod
    def _apply_rules(
        ref_low: Decimal,
        ref_high: Decimal,
        rules: list[dict[str, Any]],
    ) -> tuple[Decimal, Decimal, list[dict[str, Any]]]:
        """Sequentially apply adjustment rules to a reference range.

        Each rule is applied in two stages:

        **Stage A — Per-bound shift** (``adjustment_type``):

        +--------------+--------------------------------------------+
        | Type         | Formula                                    |
        +==============+============================================+
        | ``absolute`` | ``low += low_adj; high += high_adj``       |
        +--------------+--------------------------------------------+
        | ``percentage``| ``low += low × (low_adj / 100)`` etc.     |
        +--------------+--------------------------------------------+
        | ``override`` | ``low = low_adj; high = high_adj``         |
        +--------------+--------------------------------------------+

        **Stage B — Symmetric shift** (``operation`` + ``adjustment_value``):

        +--------------+--------------------------------------------+
        | Operation    | Formula                                    |
        +==============+============================================+
        | ``add``      | ``low += val; high += val``                |
        +--------------+--------------------------------------------+
        | ``multiply`` | ``low *= val; high *= val``                |
        +--------------+--------------------------------------------+
        | ``percentage``| ``low += low × (val / 100)`` etc.         |
        +--------------+--------------------------------------------+

        After all rules, the range is **clamped**:
        ``low = max(0, low)`` and ``high = max(low, high)``.

        Args:
            ref_low: Standard lower bound.
            ref_high: Standard upper bound.
            rules: List of rule dicts, pre-sorted by priority ASC.

        Returns:
            Tuple of ``(computed_low, computed_high, applied_list)``
            where ``applied_list`` records every rule application.
        """
        low = ref_low
        high = ref_high
        applied: list[dict[str, Any]] = []

        for rule in rules:
            rule_id = rule.get("id")
            adj_type: str = rule.get("adjustment_type", "absolute")
            low_adj = Decimal(str(rule.get("low_adjustment", 0)))
            high_adj = Decimal(str(rule.get("high_adjustment", 0)))
            operation: str = rule.get("operation", "add")
            adj_val = Decimal(str(rule.get("adjustment_value", 0)))

            prev_low, prev_high = low, high

            # ── Stage A: per-bound adjustment_type ───────────────
            if adj_type == "absolute":
                low += low_adj
                high += high_adj
            elif adj_type == "percentage":
                low += low * low_adj / _HUNDRED
                high += high * high_adj / _HUNDRED
            elif adj_type == "override":
                # Override replaces the bounds entirely.
                if low_adj != _ZERO:
                    low = low_adj
                if high_adj != _ZERO:
                    high = high_adj

            # ── Stage B: symmetric operation + adjustment_value ──
            if adj_val != _ZERO:
                if operation == "add":
                    low += adj_val
                    high += adj_val
                elif operation == "multiply":
                    low *= adj_val
                    high *= adj_val
                elif operation == "percentage":
                    low += low * adj_val / _HUNDRED
                    high += high * adj_val / _HUNDRED

            applied.append(
                {
                    "rule_id": rule_id,
                    "factor": (f"{rule.get('factor_type')}={rule.get('factor_value')}"),
                    "adjustment_type": adj_type,
                    "operation": operation,
                    "adjustment_value": str(adj_val),
                    "low_before": str(prev_low),
                    "low_after": str(low),
                    "high_before": str(prev_high),
                    "high_after": str(high),
                }
            )

        # ── Clamp ────────────────────────────────────────────────
        low = max(low, _ZERO)
        high = max(high, low)

        return low, high, applied

    # ── Persistence ──────────────────────────────────────────────

    async def _upsert_norm(
        self,
        client: AsyncClient,
        *,
        user_id: uuid.UUID,
        biomarker_id: int,
        computed_low: Decimal,
        computed_high: Decimal,
        applied_rules: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Insert or update the cached norm for a user×biomarker.

        Uses PostgREST ``upsert`` with the unique constraint
        ``(user_id, biomarker_id)`` to avoid duplicate rows.

        Args:
            client: Supabase async client.
            user_id: Profile UUID.
            biomarker_id: Biomarker PK.
            computed_low: Personalised lower bound.
            computed_high: Personalised upper bound.
            applied_rules: Audit trail of applied rules.

        Returns:
            The upserted row as a dict.
        """
        payload = {
            "user_id": str(user_id),
            "biomarker_id": biomarker_id,
            "computed_low": str(computed_low),
            "computed_high": str(computed_high),
            "applied_rules": applied_rules,
        }

        try:
            response = (
                await client.table("user_dynamic_norms")
                .upsert(
                    payload,
                    on_conflict="user_id,biomarker_id",
                )
                .execute()
            )
        except Exception as exc:
            raise DatabaseError(
                f"Failed to upsert dynamic norm for "
                f"user={user_id} biomarker={biomarker_id}: {exc}"
            ) from exc

        if not response.data:
            raise DatabaseError("Upsert returned no data")

        return response.data[0]


# ── Module-level singleton ───────────────────────────────────────────
dynamic_norm_engine = DynamicNormEngine()
