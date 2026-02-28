"""Pydantic V2 schemas for the ``biomarkers`` table.

Provides request/response models for biomarker dictionary operations.
Category values use ``Literal`` types mirroring the SQL ``CHECK``
constraint on the ``category`` column.
"""

from __future__ import annotations

import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ── Enum-like Literal type (mirrors SQL CHECK constraint) ────────────

BiomarkerCategory = Literal["vitamin", "mineral", "hormone", "enzyme", "lipid", "other"]


# ── Base schema ──────────────────────────────────────────────────────


class BiomarkerBase(BaseModel):
    """Shared fields for biomarker create and read operations."""

    code: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Unique machine-readable code, e.g. VIT_D_25OH",
    )
    name_en: str = Field(
        ...,
        min_length=1,
        description="English display name",
    )
    name_ru: str | None = Field(
        default=None,
        description="Russian display name",
    )

    category: BiomarkerCategory

    unit: str = Field(
        ...,
        min_length=1,
        description="Measurement unit, e.g. ng/mL, µmol/L",
    )

    ref_range_low: Decimal | None = Field(default=None, ge=0, decimal_places=3)
    ref_range_high: Decimal | None = Field(default=None, ge=0, decimal_places=3)
    optimal_range_low: Decimal | None = Field(default=None, ge=0, decimal_places=3)
    optimal_range_high: Decimal | None = Field(default=None, ge=0, decimal_places=3)

    description: str | None = None
    aliases: list[str] = Field(default_factory=list)


# ── Create schema ────────────────────────────────────────────────────


class BiomarkerCreate(BiomarkerBase):
    """Schema for creating a new biomarker (admin/service_role only)."""


# ── Update schema ────────────────────────────────────────────────────


class BiomarkerUpdate(BaseModel):
    """Schema for partial biomarker updates (PATCH semantics).

    All fields are optional. Only provided fields are updated.
    ``code`` is immutable and cannot be changed after creation.
    """

    name_en: str | None = Field(default=None, min_length=1)
    name_ru: str | None = None

    category: BiomarkerCategory | None = None
    unit: str | None = Field(default=None, min_length=1)

    ref_range_low: Decimal | None = Field(default=None, ge=0, decimal_places=3)
    ref_range_high: Decimal | None = Field(default=None, ge=0, decimal_places=3)
    optimal_range_low: Decimal | None = Field(default=None, ge=0, decimal_places=3)
    optimal_range_high: Decimal | None = Field(default=None, ge=0, decimal_places=3)

    description: str | None = None
    aliases: list[str] | None = None
    is_active: bool | None = None


# ── Read (response) schema ───────────────────────────────────────────


class BiomarkerRead(BiomarkerBase):
    """Schema returned by the API when reading a biomarker."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
