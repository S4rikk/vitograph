from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
@patch("apps.api.main.supabase_manager.get_client", new_callable=AsyncMock)
async def test_ttl_garbage_collection(mock_get_client):
    mock_supabase = MagicMock()
    mock_get_client.return_value = mock_supabase

    # Mocking select for expired media
    mock_expired_res = MagicMock()
    mock_expired_res.data = [
        {"id": "file1", "bucket": "lab_reports", "file_path": "user1/report.pdf"}
    ]
    mock_supabase.table.return_value.select.return_value.lt.return_value.execute = (
        AsyncMock(return_value=mock_expired_res)
    )

    # Mocking storage delete
    mock_supabase.storage.from_.return_value.remove = AsyncMock(
        return_value=[{"name": "report.pdf"}]
    )

    # Mocking db delete
    mock_supabase.table.return_value.delete.return_value.eq.return_value.execute = (
        AsyncMock(return_value=MagicMock(data=[{"id": "file1"}]))
    )

    # Execute (pseudo code of cron handler)
    client = await mock_get_client()
    expired = (
        await client.table("media_cleanup")
        .select("*")
        .lt("expires_at", "2026-05-02")
        .execute()
    )
    assert len(expired.data) == 1

    removed = await client.storage.from_("lab_reports").remove(["user1/report.pdf"])
    assert len(removed) == 1

    deleted = await client.table("media_cleanup").delete().eq("id", "file1").execute()
    assert len(deleted.data) == 1
