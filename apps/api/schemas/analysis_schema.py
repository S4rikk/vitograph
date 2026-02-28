"""Pydantic V2 schemas for the analysis endpoint.

Defines response models for comparing a user's actual blood test
results against their personalized dynamic norms.
"""

from __future__ import annotations

import datetime
import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ── Status classification ────────────────────────────────────────────

BiomarkerStatus = Literal[
    "optimal",
    "low",
    "high",
    "critical_low",
    "critical_high",
    "no_norm",
]


# ── Per-biomarker analysis item ──────────────────────────────────────


class AnalyzedBiomarkerItem(BaseModel):
    """Result of comparing a single biomarker value to its norm.

    Attributes:
        biomarker_id: FK to the biomarker dictionary.
        biomarker_code: Machine-readable biomarker code.
        biomarker_name: Human-readable English name.
        unit: Measurement unit.
        actual_value: The user's measured value.
        norm_low: Personalized lower bound (or ``None`` if no
            norm exists).
        norm_high: Personalized upper bound (or ``None``).
        status: Classification — optimal / low / high /
            critical_low / critical_high / no_norm.
        variance_pct: How far the actual value is from the nearest
            bound, expressed as a percentage.  Positive means
            *above* the upper bound; negative means *below*
            the lower bound; zero means within range.
    """

    biomarker_id: int
    biomarker_code: str = ""
    biomarker_name: str = ""
    unit: str
    actual_value: Decimal
    norm_low: Decimal | None = None
    norm_high: Decimal | None = None
    status: BiomarkerStatus
    variance_pct: Decimal = Field(
        default=Decimal("0"),
        description="Percentage deviation from the nearest bound",
    )


# ── Session-level analysis response ─────────────────────────────────


class SessionAnalysisResponse(BaseModel):
    """Full analysis of a test session against dynamic norms.

    Attributes:
        user_id: Profile UUID.
        session_id: Analysed test session PK.
        test_date: Date of the blood test.
        analyzed_at: Timestamp when the analysis was computed.
        total_biomarkers: Number of biomarkers in this session.
        summary: Count breakdown by status category.
        items: Per-biomarker analysis details.
    """

    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    session_id: int
    test_date: datetime.date
    analyzed_at: datetime.datetime
    total_biomarkers: int
    summary: dict[str, int]
    items: list[AnalyzedBiomarkerItem]
