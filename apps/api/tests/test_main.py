from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def mock_env():
    # Force settings
    from apps.api.core.config import settings

    settings.openai_api_key = "test_key"
    settings.supabase_url = "http://localhost"
    settings.supabase_key = "test_key"


from apps.api.main import enrich_biomarkers_with_insights  # noqa: E402
from apps.api.services.file_parser import BiomarkerResult  # noqa: E402


@pytest.mark.asyncio
@patch("apps.api.main.asyncio.create_task")
@patch("apps.api.main.supabase_manager.get_client", new_callable=AsyncMock)
@patch("apps.api.main.AsyncOpenAI")
async def test_enrich_biomarkers_exact_cache_hit(
    mock_async_openai, mock_get_client, mock_create_task
):
    mock_openai = AsyncMock()
    mock_async_openai.return_value.chat.completions.create = mock_openai
    # Setup mock supabase client
    mock_supabase = MagicMock()
    mock_get_client.return_value = mock_supabase

    # Mock exact match cache hit
    mock_response = MagicMock()
    mock_response.data = [
        {"id": "1", "ai_clinical_note": "Cached note", "hit_count": 0}
    ]
    mock_eq = mock_supabase.table.return_value.select.return_value.eq
    mock_eq.return_value.limit.return_value.execute = AsyncMock(
        return_value=mock_response
    )

    # Test input
    biomarkers = [
        BiomarkerResult(
            original_name="WBC",
            standardized_slug="wbc",
            value_numeric=5.0,
            reference_range={"text": "4.0-10.0", "low": 4.0, "high": 10.0},
        )
    ]

    result = await enrich_biomarkers_with_insights(biomarkers, locale="en")

    # Assertions
    assert result[0].ai_clinical_note == "Cached note"
    assert result[0].flag == "Normal"

    # Verify OpenAI was NOT called because of exact cache hit
    mock_openai.assert_not_awaited()


@pytest.mark.asyncio
@patch("apps.api.main.asyncio.create_task")
@patch("apps.api.main.supabase_manager.get_client", new_callable=AsyncMock)
@patch("apps.api.main.AsyncOpenAI")
@patch("apps.api.main.embedding_model.embed")
async def test_enrich_biomarkers_cache_miss_llm_fallback(
    mock_embed, mock_async_openai, mock_get_client, mock_create_task
):
    mock_llm_response = MagicMock()
    mock_llm_response.choices[
        0
    ].message.content = '{"notes": [{"index": 0, "ai_clinical_note": "New LLM note"}]}'
    mock_openai = AsyncMock(return_value=mock_llm_response)
    mock_async_openai.return_value.chat.completions.create = mock_openai

    # Setup mock supabase client
    mock_supabase = MagicMock()
    mock_get_client.return_value = mock_supabase

    # Mock cache miss for both Tier 1 and Tier 2
    mock_exact_response = MagicMock()
    mock_exact_response.data = []
    mock_eq = mock_supabase.table.return_value.select.return_value.eq
    mock_eq.return_value.limit.return_value.execute = AsyncMock(
        return_value=mock_exact_response
    )

    mock_rpc_response = MagicMock()
    mock_rpc_response.data = []
    mock_supabase.rpc.return_value.execute = AsyncMock(return_value=mock_rpc_response)

    # Mock embeddings
    mock_embed.return_value = [MagicMock(tolist=lambda: [0.1, 0.2, 0.3])]

    # Test input
    biomarkers = [
        BiomarkerResult(
            original_name="WBC",
            standardized_slug="wbc",
            value_numeric=2.0,
            reference_range={"text": "4.0-10.0", "low": 4.0, "high": 10.0},
        )
    ]

    result = await enrich_biomarkers_with_insights(biomarkers, locale="ru")

    # Assertions
    assert result[0].ai_clinical_note == "New LLM note"
    assert result[0].flag == "Low"

    # Verify OpenAI WAS called
    mock_openai.assert_awaited_once()
