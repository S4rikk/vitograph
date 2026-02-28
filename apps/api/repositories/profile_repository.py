"""Repository for ``profiles`` table CRUD operations.

Uses the Supabase Python async client (PostgREST) to interact with
the ``profiles`` table.  All methods accept an ``AsyncClient``
so the repository stays stateless and easily testable.
"""

from __future__ import annotations

import logging
import uuid
from typing import TYPE_CHECKING, Any

from core.exceptions import (
    DatabaseError,
    RecordAlreadyExistsError,
    RecordNotFoundError,
)
from schemas.profile_schema import (
    ProfileCreate,
    ProfileRead,
    ProfileUpdate,
)

if TYPE_CHECKING:
    from supabase import AsyncClient

logger = logging.getLogger(__name__)

_TABLE = "profiles"


class ProfileRepository:
    """Data-access layer for the ``profiles`` table.

    Every method receives a ``client: AsyncClient`` so the
    repository itself is stateless — FastAPI injects the client
    via ``Depends(get_supabase_client)``.
    """

    # ── CREATE ───────────────────────────────────────────────────

    async def create(
        self,
        client: AsyncClient,
        data: ProfileCreate,
    ) -> ProfileRead:
        """Insert a new profile row.

        Args:
            client: Supabase async client.
            data: Validated profile creation payload.

        Returns:
            The newly created profile.

        Raises:
            RecordAlreadyExistsError: If a profile with the same
                ``id`` already exists.
            DatabaseError: On any other database failure.
        """
        try:
            response = (
                await client.table(_TABLE)
                .insert(data.model_dump(mode="json"))
                .execute()
            )
        except Exception as exc:
            error_msg = str(exc).lower()
            if "duplicate" in error_msg or "unique" in error_msg:
                raise RecordAlreadyExistsError(
                    table=_TABLE,
                    identifier=str(data.id),
                ) from exc
            logger.exception("Failed to create profile %s", data.id)
            raise DatabaseError(f"Failed to create profile: {exc}") from exc

        if not response.data:
            raise DatabaseError("Insert returned no data")

        logger.info("Created profile %s", data.id)
        return ProfileRead.model_validate(response.data[0])

    # ── READ (single) ────────────────────────────────────────────

    async def get_by_id(
        self,
        client: AsyncClient,
        profile_id: uuid.UUID,
    ) -> ProfileRead:
        """Fetch a single profile by its UUID.

        Args:
            client: Supabase async client.
            profile_id: UUID matching ``auth.users.id``.

        Returns:
            The matching profile.

        Raises:
            RecordNotFoundError: If no profile exists for the id.
            DatabaseError: On any other database failure.
        """
        try:
            response = (
                await client.table(_TABLE)
                .select("*")
                .eq("id", str(profile_id))
                .maybe_single()
                .execute()
            )
        except Exception as exc:
            logger.exception("Failed to fetch profile %s", profile_id)
            raise DatabaseError(f"Failed to fetch profile: {exc}") from exc

        if response is None or not getattr(response, "data", None):
            raise RecordNotFoundError(
                table=_TABLE,
                identifier=str(profile_id),
            )

        return ProfileRead.model_validate(response.data)

    # ── UPDATE / UPSERT ──────────────────────────────────────────

    async def update(
        self,
        client: AsyncClient,
        profile_id: uuid.UUID,
        data: ProfileUpdate,
        extra_fields: dict[str, Any] | None = None,
    ) -> ProfileRead:
        """Partially update or Upsert an existing profile.

        If the profile doesn't exist, it creates one (Upsert behavior).

        Args:
            client: Supabase async client.
            profile_id: UUID of the profile to update.
            data: Validated partial-update payload.
            extra_fields: Additional fields to merge into the payload before upserting.

        Returns:
            The updated profile.

        Raises:
            DatabaseError: On database failure.
        """
        # We need to upsert, so we include 'id'.
        upsert_payload = data.model_dump(
            mode="json",
            exclude_unset=True,
        )
        upsert_payload["id"] = str(profile_id)
        
        if extra_fields:
            upsert_payload.update(extra_fields)

        try:
            response = (
                await client.table(_TABLE)
                .upsert(upsert_payload, on_conflict="id")
                .execute()
            )
        except Exception as exc:
            logger.exception("Failed to upsert profile %s", profile_id)
            raise DatabaseError(f"Failed to upsert profile: {exc}") from exc

        if response is None or not getattr(response, "data", None):
            # If for some reason upsert returns empty
            raise RecordNotFoundError(
                table=_TABLE,
                identifier=str(profile_id),
            )

        logger.info("Upserted profile %s", profile_id)
        return ProfileRead.model_validate(response.data[0])

    # ── DELETE ───────────────────────────────────────────────────

    async def delete(
        self,
        client: AsyncClient,
        profile_id: uuid.UUID,
    ) -> bool:
        """Delete a profile row.

        Args:
            client: Supabase async client.
            profile_id: UUID of the profile to delete.

        Returns:
            ``True`` if the row was deleted.

        Raises:
            RecordNotFoundError: If no profile exists for the id.
            DatabaseError: On any other database failure.
        """
        try:
            response = (
                await client.table(_TABLE).delete().eq("id", str(profile_id)).execute()
            )
        except Exception as exc:
            logger.exception("Failed to delete profile %s", profile_id)
            raise DatabaseError(f"Failed to delete profile: {exc}") from exc

        if not response.data:
            raise RecordNotFoundError(
                table=_TABLE,
                identifier=str(profile_id),
            )

        logger.info("Deleted profile %s", profile_id)
        return True


# ── Module-level singleton ───────────────────────────────────────────
profile_repository = ProfileRepository()
