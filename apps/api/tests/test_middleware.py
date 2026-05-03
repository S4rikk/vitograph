from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from apps.api.core.database import get_supabase_client


@pytest.mark.asyncio
@patch("apps.api.core.database.supabase_manager")
async def test_auth_middleware_missing_token(mock_manager):
    # Mocking Request with no Authorization header
    mock_request = MagicMock()
    mock_request.headers.get.return_value = None

    # Missing token should fallback to shared client
    mock_manager.get_client = AsyncMock()
    await get_supabase_client(mock_request)
    mock_manager.get_client.assert_awaited_once()


@pytest.mark.asyncio
@patch("apps.api.core.database.create_async_client")
async def test_auth_middleware_valid_token(mock_create_async_client):
    mock_request = MagicMock()
    mock_request.headers.get.return_value = "Bearer valid_token"

    mock_supabase = AsyncMock()
    mock_create_async_client.return_value = mock_supabase

    client = await get_supabase_client(mock_request)
    assert client is not None
    mock_create_async_client.assert_awaited_once()
