"""PDF Parser Service — Regex-based extraction of biomarker values.

This service processes raw PDF bytes, extracts text using Pydantic,
and apples REGEX patterns to find standard biomarkers.

Supported Biomarkers:
- Ferritin
- Vitamin D
- Vitamin B12
"""

import io
import re
from typing import List

from pydantic import BaseModel
from pypdf import PdfReader

# ── Schemas ──────────────────────────────────────────────────────────

class BiomarkerResult(BaseModel):
    name: str
    value: float
    unit: str
    raw_match: str

# ── Patterns ─────────────────────────────────────────────────────────

# Patterns are designed to be flexible with whitespace and separators.
# Group 1: Value (allows dot or comma)
# Group 2: Unit
PATTERNS = {
    "Ferritin": re.compile(r"(?:Ferritin|Ферритин)[\s\.:]+([\d\.,]+)[\s]*(ng/ml|ug/l|µg/L|мкг/л|нг/мл)", re.IGNORECASE),  # noqa: E501
    "Vitamin D": re.compile(r"(?:Vitamin D|Витамин Д|25-OH)[\s\.:\(25-OH\)]*([\d\.,]+)[\s]*(ng/ml|nmol/L|нг/мл|нмоль/л)", re.IGNORECASE),  # noqa: E501
    "Vitamin B12": re.compile(r"(?:Vitamin B12|Витамин B12|Витамин В12)[\s\.:]+([\d\.,]+)[\s]*(pg/ml|pmol/L|пг/мл|пмоль/л)", re.IGNORECASE),  # noqa: E501
    "Glucose": re.compile(r"(?:Glucose|Глюкоза)[\s\.:]+([\d\.,]+)[\s]*(mmol/l|mg/dl|ммоль/л|мг/дл)", re.IGNORECASE),  # noqa: E501
    "Iron": re.compile(r"(?:Iron|Железо(?: сывороточное)?)[\s\.:]+([\d\.,]+)[\s]*(umol/l|µmol/l|ug/dl|мкмоль/л|мкг/дл)", re.IGNORECASE),  # noqa: E501
    "Cholesterol": re.compile(r"(?:Cholesterol|Холестерин(?: общий)?)[\s\.:]+([\d\.,]+)[\s]*(mmol/l|mg/dl|ммоль/л|мг/дл)", re.IGNORECASE),  # noqa: E501
    "TSH": re.compile(r"(?:TSH|ТТГ|Тиреотропный гормон)[\s\.:]+([\d\.,]+)[\s]*(mIU/l|uIU/ml|мкМЕ/мл|мЕд/л)", re.IGNORECASE),  # noqa: E501
    "Free T4": re.compile(r"(?:Free T4|Т4 свободный|Т4 св)[\s\.:]+([\d\.,]+)[\s]*(pmol/l|ng/dl|пмоль/л|нг/дл)", re.IGNORECASE),  # noqa: E501
    "Anti-TPO": re.compile(r"(?:Anti-TPO|Анти-ТПО|АТ-ТПО|АТ к ТПО)[\s\.:]+([\d\.,]+)[\s]*(IU/ml|kIU/l|МЕ/мл|ед/мл)", re.IGNORECASE),  # noqa: E501
}

# ── Service ──────────────────────────────────────────────────────────

def extract_biomarkers(file_bytes: bytes) -> List[BiomarkerResult]:
    """Extract standard biomarkers from PDF bytes using Regex."""
    
    # 1. Extract Text
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
    except Exception as e:
        raise ValueError(f"Failed to read PDF: {str(e)}")

    results = []

    # 2. Apply Patterns
    for name, pattern in PATTERNS.items():
        match = pattern.search(text)
        if match:
            value_str = match.group(1).replace(',', '.') # Handle comma decimals
            unit_str = match.group(2)
            try:
                value = float(value_str)
                results.append(BiomarkerResult(
                    name=name,
                    value=value,
                    unit=unit_str,
                    raw_match=match.group(0)
                ))
            except ValueError:
                continue # Skip if value parsing fails

    return results
