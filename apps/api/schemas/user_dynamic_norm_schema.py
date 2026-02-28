"""Pydantic V2 schemas for the ``user_dynamic_norms`` table.

Represents the cached personalized biomarker ranges computed
by the Dynamic Norm Engine.
"""

from __future__ import annotations

import datetime
import uuid
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# ── Base schema ──────────────────────────────────────────────────────


class UserDynamicNormBase(BaseModel):
    """Shared fields for user dynamic norms.

    Attributes:
        user_id: FK to the user profile.
        biomarker_id: FK to the biomarker.
        computed_low: Personalized lower bound after adjustments.
        computed_high: Personalized upper bound after adjustments.
        applied_rules: JSON array of rule IDs and adjustments
            that produced this norm.
    """

    user_id: uuid.UUID
    biomarker_id: int
    computed_low: Decimal = Field(ge=0)
    computed_high: Decimal = Field(ge=0)
    applied_rules: list[dict[str, Any]] = Field(default_factory=list)


# ── Create / upsert schema ──────────────────────────────────────────


class UserDynamicNormUpsert(UserDynamicNormBase):
    """Schema for inserting or upserting a computed norm."""


# ── Read (response) schema ──────────────────────────────────────────


class UserDynamicNormRead(UserDynamicNormBase):
    """Schema returned when reading a computed norm."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    computed_at: datetime.datetime
