"""PDF Extractor Service — extracts biomarker data from lab reports.

Provides two-stage extraction:

1. **Text extraction** — reads raw text from a PDF file using
   ``pypdf``.
2. **LLM parsing** — sends the extracted text along with the
   active biomarker dictionary to OpenAI to produce structured
   JSON matching our schema.

Dependencies::

    pip install pypdf python-multipart openai
"""

from __future__ import annotations

import io
import json
import logging
from typing import Any

import openai
from openai import AsyncOpenAI
from pypdf import PdfReader

from core.config import settings

logger = logging.getLogger(__name__)


# ── Custom exceptions ────────────────────────────────────────────────


class PDFExtractionError(Exception):
    """Raised when PDF text extraction fails."""


class LLMParsingError(Exception):
    """Raised when the LLM call or response parsing fails."""


# ── System prompt template ───────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a medical lab report parser for the VITOGRAPH health platform.

Your task: extract biomarker test results from raw text of a lab \
report and return them as strict JSON.

## BIOMARKER DICTIONARY

Below is the list of biomarkers registered in our system. You MUST \
map each extracted result to one of these biomarkers by matching \
the name, aliases, or code. Use the `id` field as `biomarker_id`.

```json
{biomarker_dict}
```

## OUTPUT FORMAT

Return a JSON object with a single key `"results"` containing an \
array of objects. Each object must have exactly these fields:
- `"biomarker_id"` (int) — the `id` from the biomarker dictionary above
- `"value"` (string) — the numeric measurement as a string (e.g. "25.300")
- `"unit"` (string) — the measurement unit exactly as shown in the report

## RULES

1. Only extract biomarkers that exist in the dictionary above.
2. If a biomarker from the report cannot be matched to the \
dictionary, SKIP it entirely.
3. Do NOT invent or hallucinate values. Only extract what is \
explicitly present in the text.
4. The `value` must be a numeric string, no text or symbols.
5. Return `{{"results": []}}` if no biomarkers match.
6. Do NOT include any explanation, just the JSON object.
"""


class PDFExtractorService:
    """Extracts structured biomarker data from PDF lab reports.

    Uses ``pypdf`` for text extraction and OpenAI for
    intelligent parsing with context injection.
    """

    # ── Stage 1: Raw text extraction ─────────────────────────────

    @staticmethod
    def extract_text_from_pdf(file_bytes: bytes) -> str:
        """Extract all text from a PDF file.

        Reads every page of the PDF and concatenates text
        content with page separators.

        Args:
            file_bytes: Raw bytes of the PDF file.

        Returns:
            Concatenated text from all pages.

        Raises:
            PDFExtractionError: If the file is not a valid PDF
                or contains no extractable text.
        """
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
        except Exception as exc:
            raise PDFExtractionError(f"Failed to read PDF: {exc}") from exc

        if len(reader.pages) == 0:
            raise PDFExtractionError("PDF has no pages")

        pages_text: list[str] = []
        for idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages_text.append(text)
            logger.debug("Page %d: %d chars extracted", idx + 1, len(text))

        full_text = "\n\n--- Page Break ---\n\n".join(pages_text)

        if not full_text.strip():
            raise PDFExtractionError(
                "PDF contains no extractable text "
                "(possibly a scanned image — OCR required)"
            )

        logger.info(
            "Extracted %d chars from %d pages",
            len(full_text),
            len(reader.pages),
        )
        return full_text

    # ── Stage 2: LLM-based parsing (OpenAI) ─────────────────────

    @staticmethod
    async def parse_biomarkers_with_llm(
        text: str,
        active_biomarkers: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Parse extracted text into structured biomarker data.

        Uses OpenAI ``AsyncOpenAI`` with JSON mode: the active
        biomarker dictionary is embedded into the system prompt
        so the LLM can map extracted values to known biomarker IDs.

        ``response_format={"type": "json_object"}`` is used to
        guarantee parseable JSON output.

        Args:
            text: Raw text extracted from the PDF.
            active_biomarkers: List of dicts with keys
                ``id``, ``code``, ``name_en``, ``name_ru``,
                ``unit``, ``aliases``.

        Returns:
            List of dicts, each containing:
                - ``biomarker_id`` (int)
                - ``value`` (str)
                - ``unit`` (str)

        Raises:
            LLMParsingError: If the API call fails, times out,
                or returns unparseable JSON.
        """
        api_key = settings.openai_api_key
        model_name = settings.openai_model

        if not api_key:
            raise LLMParsingError(
                "OPENAI_API_KEY is not configured. Add your OpenAI API key to .env."
            )

        # Build the biomarker dictionary for context injection.
        biomarker_dict = json.dumps(
            [
                {
                    "id": b["id"],
                    "code": b.get("code", ""),
                    "name_en": b.get("name_en", ""),
                    "name_ru": b.get("name_ru", ""),
                    "unit": b.get("unit", ""),
                    "aliases": b.get("aliases", []),
                }
                for b in active_biomarkers
            ],
            ensure_ascii=False,
            indent=2,
        )

        system_prompt = _SYSTEM_PROMPT.format(biomarker_dict=biomarker_dict)

        logger.info(
            "Calling OpenAI (%s) with %d chars of text and %d biomarkers in context",
            model_name,
            len(text),
            len(active_biomarkers),
        )

        try:
            client = AsyncOpenAI(api_key=api_key)

            response = await client.chat.completions.create(
                model=model_name,
                response_format={"type": "json_object"},
                temperature=0.1,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": (
                            "Extract biomarker results from "
                            "the following lab report text:\n\n"
                            f"{text}"
                        ),
                    },
                ],
            )
        except openai.RateLimitError as exc:
            raise LLMParsingError(f"OpenAI rate limit exceeded: {exc}") from exc
        except openai.AuthenticationError as exc:
            raise LLMParsingError(
                f"OpenAI authentication failed — check OPENAI_API_KEY: {exc}"
            ) from exc
        except openai.APITimeoutError as exc:
            raise LLMParsingError(f"OpenAI request timed out: {exc}") from exc
        except openai.APIError as exc:
            raise LLMParsingError(f"OpenAI API error: {exc}") from exc

        # ── Parse the JSON response ──────────────────────────────
        raw_content = response.choices[0].message.content or ""
        if not raw_content.strip():
            raise LLMParsingError("OpenAI returned an empty response")

        try:
            parsed = json.loads(raw_content)
        except json.JSONDecodeError as exc:
            raise LLMParsingError(
                f"Failed to parse OpenAI JSON response: {exc}\nRaw: {raw_content[:500]}"
            ) from exc

        # Handle both {"results": [...]} and bare [...] formats.
        if isinstance(parsed, dict):
            results = parsed.get("results", [])
        elif isinstance(parsed, list):
            results = parsed
        else:
            raise LLMParsingError(f"Unexpected response structure: {type(parsed)}")

        logger.info("LLM extracted %d biomarker results", len(results))
        return results


# ── Module-level singleton ───────────────────────────────────────────
pdf_extractor_service = PDFExtractorService()
