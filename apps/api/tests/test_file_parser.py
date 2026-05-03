from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from apps.api.services.file_parser import (
    BiomarkerResult,
    LabReportExtraction,
    ReferenceRange,
    extract_biomarkers,
)


@pytest.fixture(autouse=True)
def mock_env():
    # Force settings
    from core.config import settings

    settings.openai_api_key = "test_key"
    settings.supabase_url = "http://localhost"
    settings.supabase_key = "test_key"


@pytest.mark.asyncio
@patch("apps.api.services.file_parser.AsyncOpenAI")
async def test_extract_biomarkers_txt(mock_async_openai):
    # Mock the LLM response
    mock_response = MagicMock()
    mock_response.choices[0].message.parsed = LabReportExtraction(
        report_date="2026-05-02",
        context="Routine checkup",
        biomarkers=[
            BiomarkerResult(
                original_name="WBC",
                standardized_slug="wbc",
                value_numeric=4.5,
                unit="10^9/L",
                reference_range=ReferenceRange(text="4.00-10.00", low=4.0, high=10.0),
                flag="Normal",
            )
        ],
    )

    mock_parse = AsyncMock(return_value=mock_response)
    mock_async_openai.return_value.beta.chat.completions.parse = mock_parse

    # Call the parser
    file_bytes = b"WBC 4.5 10^9/L 4.00-10.00"
    result = await extract_biomarkers(file_bytes, "report.txt", locale="en")

    # Assertions
    assert isinstance(result, LabReportExtraction)
    assert result.report_date == "2026-05-02"
    assert len(result.biomarkers) == 1
    assert result.biomarkers[0].original_name == "WBC"
    assert result.biomarkers[0].value_numeric == 4.5

    # Assert mock called
    mock_parse.assert_awaited_once()


@pytest.mark.asyncio
async def test_extract_biomarkers_unsupported_extension():
    with pytest.raises(ValueError, match="Unsupported file format"):
        await extract_biomarkers(b"dummy", "report.exe", locale="en")
