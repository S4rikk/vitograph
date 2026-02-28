"""REST API endpoints for user profiles.

Exposes ``GET`` and ``PATCH`` operations on the ``profiles`` table,
delegating data access to :class:`ProfileRepository` and receiving
the Supabase ``AsyncClient`` via FastAPI dependency injection.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from core.database import get_supabase_client
from core.exceptions import (
    DatabaseError,
    RecordAlreadyExistsError,
    RecordNotFoundError,
)
from repositories.profile_repository import ProfileRepository
from schemas.profile_schema import ProfileCreate, ProfileRead, ProfileUpdate
from supabase import AsyncClient

router = APIRouter()


# ── Dependencies ─────────────────────────────────────────────────────


def get_profile_repository() -> ProfileRepository:
    """Provide a ``ProfileRepository`` instance via DI."""
    return ProfileRepository()


# Annotated shortcuts for cleaner signatures
DbClient = Annotated[AsyncClient, Depends(get_supabase_client)]
ProfileRepo = Annotated[ProfileRepository, Depends(get_profile_repository)]


# ── GET /profiles/{user_id} ──────────────────────────────────────────


@router.get(
    "/{user_id}",
    response_model=ProfileRead,
    summary="Get a user profile",
    description="Retrieve a single profile by user UUID.",
)
async def get_profile(
    user_id: uuid.UUID,
    db: DbClient,
    repo: ProfileRepo,
) -> ProfileRead:
    """Return the profile matching *user_id*.

    Raises:
        HTTPException 404: If the profile does not exist.
        HTTPException 500: On unexpected database errors.
    """
    try:
        return await repo.get_by_id(db, user_id)
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


# ── POST /profiles ───────────────────────────────────────────────────


@router.post(
    "",
    response_model=ProfileRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user profile",
    description=(
        "Create a new profile linked to an ``auth.users`` UUID. "
        "Typically called once during user onboarding."
    ),
)
async def create_profile(
    payload: ProfileCreate,
    db: DbClient,
    repo: ProfileRepo,
) -> ProfileRead:
    """Insert a new profile row.

    Raises:
        HTTPException 409: If a profile with this id already exists.
        HTTPException 500: On unexpected database errors.
    """
    try:
        return await repo.create(db, payload)
    except RecordAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(f"Profile {payload.id} already exists"),
        )
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


# ── PATCH /profiles/{user_id} ────────────────────────────────────────


@router.patch(
    "/{user_id}",
    response_model=ProfileRead,
    summary="Update a user profile",
    description=(
        "Partially update a profile. Only provided fields are "
        "changed (PATCH semantics)."
    ),
)
async def update_profile(
    user_id: uuid.UUID,
    payload: ProfileUpdate,
    db: DbClient,
    repo: ProfileRepo,
) -> ProfileRead:
    """Apply a partial update to the profile matching *user_id*.

    Raises:
        HTTPException 404: If the profile does not exist.
        HTTPException 500: On unexpected database errors.
    """
    update_data = payload.model_dump(exclude_unset=True)
    influential_fields = {
        "activity_level",
        "stress_level",
        "diet_type",
        "environment_aqi",
        "chronic_conditions",
    }
    
    extra_fields = {}
    if any(field in update_data for field in influential_fields):
        # Safely invalidate the AI nutrition targets cache in the DB with an empty dict to respect NOT NULL constraint
        extra_fields["active_nutrition_targets"] = {}
        
    try:
        return await repo.update(db, user_id, payload, extra_fields=extra_fields)
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
