"""Pydantic V2 schemas for the ``dynamic_norm_rules`` table.

These schemas represent the rules that define how lifestyle
and environment factors shift standard biomarker reference ranges.
"""

from __future__ import annotations

import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ── Type aliases ─────────────────────────────────────────────────────

AdjustmentType = Literal["absolute", "percentage", "override"]
OperationType = Literal["add", "multiply", "percentage"]


# ── Base schema ──────────────────────────────────────────────────────


class DynamicNormRuleBase(BaseModel):
    """Shared fields for dynamic norm rules.

    Attributes:
        biomarker_id: FK to the biomarker this rule adjusts.
        factor_type: Profile field name (e.g. ``stress_level``).
        factor_value: Specific value that triggers the rule
            (e.g. ``high``).
        adjustment_type: How the adjustment is applied to bounds.
        operation: Mathematical operation for ``adjustment_value``.
        adjustment_value: Scalar used by ``operation``.
        low_adjustment: Direct additive shift to ``ref_range_low``.
        high_adjustment: Direct additive shift to ``ref_range_high``.
        priority: Higher priority rules are applied last (win
            on conflict).
        rationale: Scientific rationale for this rule.
        source_reference: Optional link to study / guideline.
        is_active: Whether this rule is currently active.
    """

    biomarker_id: int
    factor_type: str
    factor_value: str

    adjustment_type: AdjustmentType = "absolute"
    operation: OperationType = "add"
    adjustment_value: Decimal = Field(default=Decimal("0"))

    low_adjustment: Decimal = Field(default=Decimal("0"))
    high_adjustment: Decimal = Field(default=Decimal("0"))

    priority: int = Field(default=0, ge=0)
    rationale: str | None = None
    source_reference: str | None = None
    is_active: bool = True


# ── Create schema ────────────────────────────────────────────────────


class DynamicNormRuleCreate(DynamicNormRuleBase):
    """Schema for inserting a new dynamic norm rule."""


# ── Read (response) schema ──────────────────────────────────────────


class DynamicNormRuleRead(DynamicNormRuleBase):
    """Schema returned when reading a dynamic norm rule."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
