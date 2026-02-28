"""Pydantic V2 schemas for analytics endpoints.

Provides response models for micronutrient trends and lab schedule predictions.
"""

from __future__ import annotations

import datetime
from typing import Literal

from pydantic import BaseModel, Field

# ── Micronutrient Trends ──────────────────────────────────────────────

class MicronutrientTrendDay(BaseModel):
    """Represents aggregated micronutrients for a single day.
    
    Since the keys are dynamic (Russian names of vitamins/minerals),
    this model captures the date and allows any additional fields.
    """
    date: str = Field(..., description="Date in YYYY-MM-DD format")

    model_config = {
        "extra": "allow",
    }


# ── Lab Schedule ─────────────────────────────────────────────────────

LabStatus = Literal["due", "upcoming", "optimal"]

class LabScheduleItem(BaseModel):
    """Represents a recommendation for a single biomarker test."""
    
    biomarker_name: str
    status: LabStatus
    recommended_date: datetime.date | None = None
    rationale: str
