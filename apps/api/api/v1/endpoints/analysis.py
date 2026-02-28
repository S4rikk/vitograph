"""REST API endpoint for session analysis.

Compares actual blood test results from a specific session
against the user's personalised dynamic norms.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from core.database import get_supabase_client
from core.exceptions import DatabaseError, RecordNotFoundError
from schemas.analysis_schema import SessionAnalysisResponse
from services.analysis_service import AnalysisService
from supabase import AsyncClient

router = APIRouter()


# ── Dependencies ─────────────────────────────────────────────────────


def get_analysis_service() -> AnalysisService:
    """Provide an ``AnalysisService`` instance via DI."""
    return AnalysisService()


DbClient = Annotated[AsyncClient, Depends(get_supabase_client)]
Service = Annotated[AnalysisService, Depends(get_analysis_service)]


# ── GET /analysis/{user_id}/sessions/{session_id} ────────────────────


@router.get(
    "/{user_id}/sessions/{session_id}",
    response_model=SessionAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyse a test session",
    description=(
        "Compare the user's actual biomarker values from a "
        "specific test session against their personalised "
        "dynamic norms.  Returns per-biomarker status "
        "(optimal / low / high / critical) and variance."
    ),
)
async def analyze_session(
    user_id: uuid.UUID,
    session_id: int,
    db: DbClient,
    svc: Service,
) -> SessionAnalysisResponse:
    """Run session analysis and return structured results.

    Args:
        user_id: UUID of the user profile.
        session_id: PK of the test session to analyse.
        db: Supabase async client (injected).
        svc: AnalysisService instance (injected).

    Returns:
        Session analysis with per-biomarker status and summary.

    Raises:
        HTTPException 404: If profile or session not found.
        HTTPException 500: On database errors.
    """
    try:
        return await svc.analyze_session(db, user_id, session_id)
    except RecordNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
