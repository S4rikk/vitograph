"""REST API endpoints for dynamic norm calculations.

Exposes the ``DynamicNormEngine`` through a ``POST`` endpoint
that triggers personalized biomarker range computation for a
given user.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from core.database import get_supabase_client
from core.exceptions import DatabaseError, RecordNotFoundError
from services.dynamic_norm_service import DynamicNormEngine
from supabase import AsyncClient

router = APIRouter()


# ── Dependencies ─────────────────────────────────────────────────────


def get_engine() -> DynamicNormEngine:
    """Provide a ``DynamicNormEngine`` instance via DI."""
    return DynamicNormEngine()


DbClient = Annotated[AsyncClient, Depends(get_supabase_client)]
Engine = Annotated[DynamicNormEngine, Depends(get_engine)]


# ── POST /norms/{user_id}/calculate ──────────────────────────────────


@router.post(
    "/{user_id}/calculate",
    status_code=status.HTTP_200_OK,
    summary="Calculate dynamic norms",
    description=(
        "Run the Dynamic Norm Engine for a specific user. "
        "Fetches the user's profile factors, retrieves all "
        "applicable rules, applies mathematical adjustments "
        "to standard biomarker ranges, and caches the results."
    ),
)
async def calculate_norms(
    user_id: uuid.UUID,
    db: DbClient,
    engine: Engine,
) -> list[dict[str, Any]]:
    """Trigger a full dynamic norm recalculation for *user_id*.

    Returns:
        List of computed norms with ``biomarker_id``,
        ``computed_low``, ``computed_high``, and
        ``applied_rules`` for each processed biomarker.

    Raises:
        HTTPException 404: If the user profile does not exist.
        HTTPException 500: On unexpected database errors.
    """
    try:
        return await engine.calculate_dynamic_norms(db, user_id)
    except RecordNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile {user_id} not found",
        )
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
