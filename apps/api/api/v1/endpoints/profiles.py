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


# ── GET /profiles/me ──────────────────────────────────────────────────


@router.get(
    "/me",
    response_model=ProfileRead,
    summary="Get current user profile",
    description="Retrieve the profile of the currently authenticated user.",
)
async def get_my_profile(
    db: DbClient,
    repo: ProfileRepo,
) -> ProfileRead:
    """Return the profile of the authenticated user.
    
    This endpoint relies on the sub claim in the JWT, which 
    get_supabase_client utilizes via RLS or explicit scoping.
    """
    try:
        # In Supabase, if we use a client scoped with a user JWT, 
        # RLS will ensure we only see our own profile.
        # We can try to get the user ID from the client's auth session 
        # or headers if needed, but the most robust way in this architecture 
        # is to let the repository handle the ID if we have it, 
        # OR use a specialized repo method that doesn't require ID if RLS is on.
        
        # However, looking at ProfileRepository, it expects an ID.
        # Let's extract sub from the client auth headers if possible, 
        # or use a generic approach.
        
        # get_supabase_client uses request.headers.get("Authorization")
        # We can parse the JWT here to get 'sub'.
        import jwt
        auth_header = db.options.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing authentication token",
            )
        
        token = auth_header.split(" ")[1]
        # We don't verify the signature here because Supabase/Gateway already did, 
        # we just decode to get the 'sub' field.
        payload = jwt.decode(token, options={"verify_signature": False})
        
        if "sub" not in payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing sub claim",
            )
            
        user_id = uuid.UUID(payload["sub"])
        
        return await repo.get_by_id(db, user_id)
        
    except RecordNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.patch(
    "/me",
    response_model=ProfileRead,
    summary="Update current user profile",
    description="Partially update the profile of the currently authenticated user.",
)
async def update_my_profile(
    payload: ProfileUpdate,
    db: DbClient,
    repo: ProfileRepo,
) -> ProfileRead:
    """Apply a partial update to the authenticated user's profile."""
    try:
        import jwt
        auth_header = db.options.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing authentication token",
            )
        
        token = auth_header.split(" ")[1]
        jwt_payload = jwt.decode(token, options={"verify_signature": False})
        
        if "sub" not in jwt_payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing sub claim",
            )
            
        user_id = uuid.UUID(jwt_payload["sub"])
        
        return await update_profile(user_id=user_id, payload=payload, db=db, repo=repo)
        
    except RecordNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


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
        "weight_kg",
        "height_cm",
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
