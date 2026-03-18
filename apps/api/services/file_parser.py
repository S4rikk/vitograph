"""File Parser Service — Multi-format biomarker extraction using AI.

Supports PDF, DOCX, and TXT input files. Extracts text from each format
and uses OpenAI's Structured Outputs to extract a complete, dynamic array
of biomarkers, complete with zero-tolerance hallucination rules.
"""

import io
import logging
from typing import List, Optional, Tuple

from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from pypdf import PdfReader

from core.config import settings

logger = logging.getLogger(__name__)


# ── Schemas for AI Extraction ────────────────────────────────────────

class ReferenceRange(BaseModel):
    """Encapsulates the reference range explicitly stated in the document."""
    low: Optional[float] = Field(None, description="Lower bound of normal range")
    high: Optional[float] = Field(None, description="Upper bound of normal range")
    text: Optional[str] = Field(None, description="Original text of the norm, e.g., '< 15' or 'Negative'")


class BiomarkerResult(BaseModel):
    """A single biomarker extracted dynamically from the lab report."""
    original_name: str = Field(description="Exact name from the report (e.g., 'Hemoglobin (Hb)')")
    standardized_slug: str = Field(description="Standardized unified ID, e.g., 'hemoglobin', 'tsh', 'glucose'")
    value_numeric: Optional[float] = Field(None, description="Numeric value if present")
    value_string: Optional[str] = Field(None, description="To be used if result is textual (e.g., Negative, Trace)")
    unit: Optional[str] = Field(None, description="Measurement unit exactly as stated")
    reference_range: Optional[ReferenceRange] = Field(None, description="Reference range data")
    flag: Optional[str] = Field(None, description="Normal, Low, High, Abnormal. Calculated strictly from text!")
    ai_clinical_note: Optional[str] = Field(None, description="Brief explanation (1 sentence) IN RUSSIAN of what this marker represents.")


class LabReportExtraction(BaseModel):
    """The root structure expected from the LLM."""
    report_date: Optional[str] = Field(None, description="Extracted date of the report")
    context: Optional[str] = Field(None, description="E.g., morning, fasting, cycle phase, etc. IN RUSSIAN")
    total_found_count: int = Field(0, description="The exact number of biomarker rows detected in the document.")
    biomarkers: List[BiomarkerResult] = Field(default_factory=list, description="Array of all found markers")
    general_recommendations: List[str] = Field(default_factory=list, description="General advice based on all deviations IN RUSSIAN")


SUPPORTED_EXTENSIONS = (".pdf", ".docx", ".txt")


# ── Text Extraction Helpers ──────────────────────────────────────────

def _extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF bytes using pypdf."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages)
    except Exception as exc:
        raise ValueError(f"Failed to read PDF: {exc}") from exc


def _extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    try:
        from docx import Document  # noqa: WPS433 — lazy import

        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs)
    except ImportError as exc:
        raise ValueError(
            "python-docx is required for DOCX parsing. "
            "Install it with: pip install python-docx"
        ) from exc
    except Exception as exc:
        raise ValueError(f"Failed to read DOCX: {exc}") from exc


def _extract_text_from_txt(file_bytes: bytes) -> str:
    """Decode plain-text bytes (UTF-8 with fallback to cp1251)."""
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return file_bytes.decode("cp1251")


# ── Public API ───────────────────────────────────────────────────────

async def extract_biomarkers(file_bytes: bytes, filename: str) -> LabReportExtraction:
    """Extract standard biomarkers from PDF, DOCX, or TXT file using AI.

    Args:
        file_bytes: Raw bytes of the uploaded file.
        filename: Original filename (used to determine format by extension).

    Returns:
        Structured LabReportExtraction object properly mapped by the LLM.

    Raises:
        ValueError: If the file format is unsupported or parsing fails.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        text = _extract_text_from_pdf(file_bytes)
    elif ext == "docx":
        text = _extract_text_from_docx(file_bytes)
    elif ext == "txt":
        text = _extract_text_from_txt(file_bytes)
    else:
        raise ValueError(f"Unsupported file format: .{ext}")

    logger.info("Extracted %d chars from %s (%s)", len(text), filename, ext)

    if not text.strip():
        raise ValueError("Could not extract any readable text from the file.")

    # Execute LLM Structured Parsing
    api_key = settings.openai_api_key
    model_name = settings.openai_model or "gpt-4o"
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured.")

    client = AsyncOpenAI(api_key=api_key, timeout=120.0)
    
    system_prompt = (
        "You are an expert medical lab report parser for VITOGRAPH.\n\n"
        "Your goal is to extract clinical data and return it using the strict JSON schema provided. ALL TEXT OUTPUTS (notes, recommendations, context) MUST BE IN RUSSIAN.\n\n"
        "STEPS:\n"
        "1. MENTAL OCR: First, carefully read the entire provided text and count EVERY unique biomarker row.\n"
        "2. POPULATE `total_found_count`: This number MUST exactly match the total number of items in the `biomarkers` array.\n\n"
        "ZERO-TOLERANCE RULES:\n"
        "1. NO HALLUCINATIONS: If the reference range is NOT explicitly written in the provided text, "
        "set `reference_range` to null. DO NOT hallucinate standard medical ranges from your training data. "
        "This is a strict safety requirement.\n"
        "2. DO NOT TRUNCATE: Extract EVERY single biomarker listed in the text. Do not skip any rows. "
        "Even 'Normal' findings are critical for the clinical history. A full panel might contain 50+ items.\n"
        "3. FAIL-SAFE: If the text provided does not resemble a medical lab report (e.g., a random story, "
        "a recipe, or a blank page), return an empty array for `biomarkers: []` and 0 for `total_found_count`."
    )

    try:
        completion = await client.beta.chat.completions.parse(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Extract the data from this document:\n\n{text}"}
            ],
            response_format=LabReportExtraction,
            temperature=0.0,
        )
        
        extracted_data = completion.choices[0].message.parsed
        if extracted_data is None:
            raise ValueError("Failed to parse document with LLM.")
            
        return extracted_data

    except Exception as exc:
        raise ValueError(f"LLM Parsing error: {str(exc)}") from exc


async def extract_biomarkers_from_image(
    image_bytes: bytes, content_type: str
) -> LabReportExtraction:
    """Extract biomarkers from a PHOTO of a lab report using GPT-4o Vision.

    Sends the raw image to GPT-4o's vision capabilities, which performs
    OCR + structured data extraction in a single pass.

    Args:
        image_bytes: Raw bytes of the uploaded image (JPEG/PNG/HEIC).
        content_type: MIME type of the image (e.g., "image/jpeg").

    Returns:
        Structured LabReportExtraction with all recognized biomarkers.

    Raises:
        ValueError: If the API key is missing or the LLM call fails.
    """
    import base64

    api_key = settings.openai_api_key
    model_name = settings.openai_model or "gpt-4o"
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured.")

    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    image_url = f"data:{content_type};base64,{b64_image}"

    client = AsyncOpenAI(api_key=api_key, timeout=120.0)

    system_prompt = (
        "You are an expert medical lab report parser for VITOGRAPH. ALL TEXT EXPLANATIONS (notes, recommendations, context) MUST BE IN RUSSIAN.\n\n"
        "You are receiving a PHOTO of a printed lab report form.\n"
        "STEPS:\n"
        "1. VISUAL ANCHORS: Treat the page as a structured grid. Identify columns for 'Name', 'Result', 'Unit', and 'Reference Range'.\n"
        "2. ROW ANCHORING: Every row in these reports typically starts with a numeric index (1, 2, 3...). Treat this index as a **rigid anchor**. If you skip an index, you are likely missing a biomarker.\n"
        "3. SUBTYPE AWARENESS: Explicitly distinguish between markers with similar stems but different suffixes, such as `PDW-CV` (which might be in row 24) and `PDW-SD` (which might be in row 25). Do not merge them into one entry.\n"
        "4. HORIZONTAL SCANNING: Reference ranges are often far to the right. Ensure you maintain row alignment even across wide whitespace gaps.\n"
        "5. SECOND LOOK: If you find a biomarker name but the value is missing in its usual column, perform a second look nearby (above, below, or slightly offset) before returning null.\n"
        "6. MENTAL OCR: Carefully scan the entire image and count EVERY unique biomarker row (numeric indices).\n"
        "7. POPULATE `total_found_count`: This number MUST exactly match the total number of items in the `biomarkers` array and the count of numeric indices found.\n\n"
        "ZERO-TOLERANCE RULES:\n"
        "1. NO HALLUCINATIONS: If the reference range is NOT explicitly visible "
        "in the photo, set `reference_range` to null. DO NOT hallucinate "
        "standard medical ranges.\n"
        "2. DO NOT TRUNCATE: Extract EVERY single biomarker visible. "
        "Do not skip any rows. Even 'Normal' findings are critical for clinical history.\n"
        "3. VERIFICATION: Self-audit before returning. Count the total number of numeric indices found on the page. Ensure `biomarkers.length` matches this count.\n"
        "4. FAIL-SAFE: If the image does not contain a medical lab report, "
        "return `biomarkers: []` and 0 for `total_found_count`.\n"
        "5. BLURRY TEXT: If a value is not clearly readable, set it to null "
        "rather than guessing."
    )

    try:
        completion = await client.beta.chat.completions.parse(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract all biomarker data from this lab report photo:",
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": image_url, "detail": "high"},
                        },
                    ],
                },
            ],
            response_format=LabReportExtraction,
            temperature=0.0,
        )

        extracted_data = completion.choices[0].message.parsed
        if extracted_data is None:
            raise ValueError("Failed to parse lab report photo with LLM.")
        return extracted_data

    except Exception as exc:
        raise ValueError(f"Vision parsing error: {str(exc)}") from exc


async def extract_biomarkers_from_image_batch(
    images: List[Tuple[bytes, str]]
) -> LabReportExtraction:
    """Extract biomarkers from a batch of PHOTOS of a lab report using GPT-4o Vision.

    To strictly prevent LLM laziness (skipping dense tables across multiple pages),
    this extracts data from each page concurrently, then merges the distinct results.

    Args:
        images: Array of tuples (raw_bytes, content_type) for each image.

    Returns:
        Structured LabReportExtraction with merged biomarkers.

    Raises:
        ValueError: If the LLM parallel parsing fails.
    """
    import asyncio

    if not images:
        return LabReportExtraction()

    tasks = [
        extract_biomarkers_from_image(image_bytes, content_type)
        for image_bytes, content_type in images
    ]

    try:
        results = await asyncio.gather(*tasks, return_exceptions=False)
    except Exception as exc:
        raise ValueError(f"Vision batch parsing parallel error: {str(exc)}") from exc

    merged_biomarkers = []
    merged_recommendations = []
    report_date = None
    context_str = ""

    for idx, res in enumerate(results):
        if res.biomarkers:
            merged_biomarkers.extend(res.biomarkers)
        if res.general_recommendations:
            merged_recommendations.extend(res.general_recommendations)
        if res.report_date and not report_date:
            report_date = res.report_date
        if res.context:
            page_ctx = f"[Page {idx+1}]: {res.context}"
            context_str = f"{context_str} {page_ctx}".strip()

    unique_recommendations = list(dict.fromkeys(merged_recommendations))

    return LabReportExtraction(
        report_date=report_date,
        context=context_str if context_str else None,
        total_found_count=sum(res.total_found_count for res in results),
        biomarkers=merged_biomarkers,
        general_recommendations=unique_recommendations
    )
