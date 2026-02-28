"""Pydantic V2 schemas for ``test_sessions`` and ``test_results``.

Defines the request/response models for uploading blood test data
grouped by session.
"""

from __future__ import annotations

import datetime
import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ── Type aliases ─────────────────────────────────────────────────────

SourceType = Literal["manual", "ocr_upload", "api_integration"]
SessionStatus = Literal["pending", "processing", "completed", "error"]


# ═══════════════════════════════════════════════════════════════════
# Test Session schemas
# ═══════════════════════════════════════════════════════════════════


class TestSessionBase(BaseModel):
    """Shared fields for a test session.

    Attributes:
        test_date: Date the blood test was taken.
        lab_name: Optional laboratory name.
        notes: Free-text notes about the session.
    """

    test_date: datetime.date
    lab_name: str | None = None
    notes: str | None = None


class TestSessionRead(TestSessionBase):
    """Schema returned when reading a test session."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: uuid.UUID
    status: SessionStatus
    created_at: datetime.datetime


# ═══════════════════════════════════════════════════════════════════
# Test Result schemas (individual biomarker value)
# ═══════════════════════════════════════════════════════════════════


class TestResultItem(BaseModel):
    """A single biomarker result inside a session upload.

    Attributes:
        biomarker_id: FK to the biomarker dictionary.
        value: Measured numeric value.
        unit: Measurement unit (must match the biomarker's unit).
        notes: Optional notes about this specific result.
    """

    biomarker_id: int
    value: Decimal = Field(gt=0)
    unit: str
    notes: str | None = None


class TestResultRead(BaseModel):
    """Schema returned when reading a single test result row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: uuid.UUID
    biomarker_id: int
    session_id: int | None
    value: Decimal
    unit: str
    test_date: datetime.date
    lab_name: str | None
    source: SourceType
    notes: str | None
    created_at: datetime.datetime


# ═══════════════════════════════════════════════════════════════════
# Request payload: session + results bundle
# ═══════════════════════════════════════════════════════════════════


class TestSessionCreateRequest(BaseModel):
    """Incoming payload for uploading a blood test session.

    Contains the session metadata and a list of individual
    biomarker results measured during that session.

    Attributes:
        test_date: Date the blood test was taken.
        lab_name: Optional laboratory name.
        notes: Optional notes for the session.
        source: How the data was entered.
        results: List of individual biomarker measurements.
    """

    test_date: datetime.date
    lab_name: str | None = None
    notes: str | None = None
    source: SourceType = "manual"
    results: list[TestResultItem] = Field(min_length=1)


# ═══════════════════════════════════════════════════════════════════
# Response payload: session + nested results
# ═══════════════════════════════════════════════════════════════════


class TestSessionCreateResponse(BaseModel):
    """Response after successfully creating a test session.

    Attributes:
        session: The created session row.
        results: List of created result rows.
        results_count: Number of results saved.
    """

    session: TestSessionRead
    results: list[TestResultRead]
    results_count: int
