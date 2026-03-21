"""Pydantic V2 schemas for the ``profiles`` table.

Provides request/response models for user profile CRUD operations.
All enum-like fields use ``Literal`` types that mirror the
``CHECK`` constraints defined in the SQL migration.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ── Enum-like Literal types (mirror SQL CHECK constraints) ───────────

BiologicalSex = Literal["male", "female", "other"]
ActivityLevel = Literal["sedentary", "light", "moderate", "active", "very_active"]
StressLevel = Literal["low", "moderate", "high", "very_high"]
ClimateZone = Literal["tropical", "dry", "temperate", "continental", "polar"]
SunExposure = Literal["minimal", "moderate", "high"]
DietType = Literal["omnivore", "vegetarian", "vegan", "pescatarian", "keto", "other"]
AlcoholFrequency = Literal["none", "occasional", "moderate", "heavy"]
PregnancyStatus = Literal["not_applicable", "pregnant", "breastfeeding"]


# ── Base schema ──────────────────────────────────────────────────────


class ProfileBase(BaseModel):
    """Shared fields for profile create and update operations."""

    display_name: str | None = None
    date_of_birth: datetime.date | None = None
    biological_sex: BiologicalSex | None = None

    height_cm: float | None = Field(default=None, ge=0, le=300)
    weight_kg: float | None = Field(default=None, ge=0, le=700)

    activity_level: ActivityLevel | None = None
    stress_level: StressLevel | None = None
    sleep_hours_avg: float | None = Field(default=None, ge=0, le=24)

    climate_zone: ClimateZone | None = None
    sun_exposure: SunExposure | None = None
    diet_type: DietType | None = None

    is_smoker: bool = False
    alcohol_frequency: AlcoholFrequency | None = None
    pregnancy_status: PregnancyStatus | None = None

    chronic_conditions: list[str] | None = Field(default_factory=list)
    medications: list[str] | None = Field(default_factory=list)

    city: str | None = None
    timezone: str | None = None
    ai_name: str | None = Field(default=None)


# ── Create schema ────────────────────────────────────────────────────


class ProfileCreate(ProfileBase):
    """Schema for creating a new user profile.

    The ``id`` is provided by Supabase Auth (``auth.uid()``),
    so it is required here to bind the profile to the user.
    """

    id: uuid.UUID


# ── Update schema ────────────────────────────────────────────────────


class ProfileUpdate(BaseModel):
    """Schema for partial profile updates (PATCH semantics).

    All fields are optional. Only provided fields are updated.
    """

    display_name: str | None = None
    date_of_birth: datetime.date | None = None
    biological_sex: BiologicalSex | None = None

    height_cm: float | None = Field(default=None, ge=0, le=300)
    weight_kg: float | None = Field(default=None, ge=0, le=700)

    activity_level: ActivityLevel | None = None
    stress_level: StressLevel | None = None
    sleep_hours_avg: float | None = Field(default=None, ge=0, le=24)

    climate_zone: ClimateZone | None = None
    sun_exposure: SunExposure | None = None
    diet_type: DietType | None = None

    is_smoker: bool | None = None
    alcohol_frequency: AlcoholFrequency | None = None
    pregnancy_status: PregnancyStatus | None = None

    chronic_conditions: list[str] | None = None
    medications: list[str] | None = None

    city: str | None = None
    timezone: str | None = None
    ai_name: str | None = Field(default=None)


# ── Read (response) schema ───────────────────────────────────────────


class ProfileRead(ProfileBase):
    """Schema returned by the API when reading a profile."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime.datetime | None = None
    updated_at: datetime.datetime | None = None
