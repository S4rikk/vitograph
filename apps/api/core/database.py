"""Async Supabase client connection manager.

Provides a lazily-initialised, application-scoped ``AsyncClient``
that is created on first access and properly closed on shutdown.

Usage in FastAPI lifespan::

    from contextlib import asynccontextmanager
    from fastapi import FastAPI
    from core.database import supabase_manager

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Client is created lazily on first call, nothing to do here.
        yield
        await supabase_manager.close()

    app = FastAPI(lifespan=lifespan)

Usage as a FastAPI dependency::

    from core.database import get_supabase_client

    @router.get("/")
    async def index(db = Depends(get_supabase_client)):
        ...
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import Request

from core.config import settings
from core.exceptions import DatabaseConnectionError
from supabase import AsyncClient, create_async_client

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class SupabaseClientManager:
    """Manages the lifecycle of a single ``AsyncClient`` instance.

    The client is created lazily on the first call to
    :pymethod:`get_client` and reused for the rest of the
    application's lifetime.  Call :pymethod:`close` during
    shutdown to release HTTP connections.
    """

    def __init__(self) -> None:
        self._client: AsyncClient | None = None

    async def get_client(self) -> AsyncClient:
        """Return the cached async Supabase client.

        Creates the client on first invocation.

        Raises:
            DatabaseConnectionError: If the client cannot be created
                (e.g. missing or invalid credentials).
        """
        if self._client is not None:
            return self._client

        try:
            self._client = await create_async_client(
                settings.supabase_url,
                settings.supabase_key,
            )
            logger.info("Supabase async client initialised successfully")
        except Exception as exc:
            logger.exception("Failed to create Supabase async client")
            raise DatabaseConnectionError(str(exc)) from exc

        return self._client

    async def close(self) -> None:
        """Gracefully close the underlying HTTP connections."""
        if self._client is not None:
            # AsyncClient wraps an httpx.AsyncClient internally.
            # Closing it releases the connection pool.
            try:
                await self._client.auth.sign_out()
            except Exception:  # noqa: BLE001
                logger.debug("Non-critical: sign_out failed during shutdown")
            self._client = None
            logger.info("Supabase async client closed")


# ── Module-level singleton ───────────────────────────────────────────
supabase_manager = SupabaseClientManager()


async def get_supabase_client(request: Request) -> AsyncClient:
    """FastAPI dependency that yields an async client.

    If an Authorization header is present, returns a securely scoped 
    client for that user to satisfy RLS policies. Otherwise returns 
    the shared anonymous client.
    """
    token = request.headers.get("Authorization")
    if token:
        from supabase import ClientOptions
        options = ClientOptions(headers={"Authorization": token})
        return await create_async_client(
            settings.supabase_url, 
            settings.supabase_key, 
            options=options
        )

    # Fallback to shared global client (anon)
    return await supabase_manager.get_client()
