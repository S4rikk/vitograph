"""VITOGRAPH — FastAPI application entry point.

Initialises the FastAPI app with a lifespan handler that manages
the Supabase async client lifecycle.  Includes versioned routers
and a top-level health-check endpoint.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile, status, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
import traceback
import asyncio
from fastembed import TextEmbedding

logger = logging.getLogger(__name__)

embedding_model = TextEmbedding("BAAI/bge-small-en-v1.5")

from api.v1.endpoints import analysis, analytics, norms, profiles, test_results, users
from core.database import supabase_manager
from services.file_parser import (
    BiomarkerResult,
    LabReportExtraction,
    ReferenceRange,
    extract_biomarkers,
    extract_biomarkers_from_image,
    extract_biomarkers_from_image_batch,
)
from services.norm_engine import NormResult, UserProfile, calculate_dynamic_norm
from pydantic import BaseModel
from openai import AsyncOpenAI
from core.config import settings

if TYPE_CHECKING:
    from collections.abc import AsyncIterator


# ── Lifespan ─────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Manage application startup / shutdown resources.

    On shutdown, the shared Supabase ``AsyncClient`` connection
    pool is closed gracefully.
    """
    # Startup — client is created lazily, nothing to pre-init.
    yield
    # Shutdown — release connection pool.
    await supabase_manager.close()


# ── App factory ──────────────────────────────────────────────────────

app = FastAPI(
    title="VITOGRAPH API",
    description=(
        "Health-tech AI platform that calculates a Dynamic Norm "
        "for vitamins and minerals based on user lifestyle, "
        "environment, and blood test data."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────
# Allow all origins during development; tighten for production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Pass through HTTPExceptions so they aren't caught by the global handler."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions and log full traceback."""
    error_traceback = traceback.format_exc()
    logger.error(f"Global Exception Handler caught: {exc}\n{error_traceback}")
    
    # In a real app, we might check an env var like DEBUG or ENV
    # For now, following the TZ to return detailed info if possible
    content = {
        "detail": "Internal Server Error",
        "error": str(exc)
    }
    
    # Add traceback ONLY if we are NOT in production (or keep it for now as per TZ)
    content["traceback"] = error_traceback
    
    return JSONResponse(
        status_code=500,
        content=content,
    )


# ── Routers ──────────────────────────────────────────────────────────

app.include_router(
    profiles.router,
    prefix="/api/v1/profiles",
    tags=["profiles"],
)
app.include_router(
    norms.router,
    prefix="/api/v1/norms",
    tags=["norms"],
)
app.include_router(
    test_results.router,
    prefix="/api/v1/test-results",
    tags=["test-results"],
)
app.include_router(
    analysis.router,
    prefix="/api/v1/analysis",
    tags=["analysis"],
)
app.include_router(
    analytics.router,
    prefix="/api/v1/analytics",
    tags=["analytics"],
)
app.include_router(
    users.router,
    prefix="/api/v1/users",
    tags=["users"],
)


# ── Integration Endpoints (Phase 70) ───────────────────────────────

class RefreshNotesRequest(BaseModel):
    biomarkers: List[BiomarkerResult]

class RefreshedMarker(BaseModel):
    index: int
    ai_clinical_note: str
    flag: Optional[str]

class RefreshNotesResponse(BaseModel):
    markers: List[RefreshedMarker]

def recalculate_flag(value: Optional[float], ref: Optional[ReferenceRange]) -> Optional[str]:
    """Deterministically recalculate flag based on numeric value and reference range."""
    if value is None or ref is None:
        return None
        
    # 1. Use explicit low/high if present
    if ref.low is not None and ref.high is not None:
        if value < ref.low:
            return "Low"
        if value > ref.high:
            return "High"
        return "Normal"
        
    # 2. Parse text property if low/high missing (e.g. "< 15", "> 1.5", "10-20")
    if ref.text:
        import re
        text = ref.text.strip().lower()
        
        # Match "< 15" or "<15" or "less than 15"
        less_match = re.search(r'(?:<|less than|до)\s*([\d\.,]+)', text)
        if less_match:
            try:
                threshold = float(less_match.group(1).replace(',', '.'))
                return "Normal" if value < threshold else "High"
            except ValueError:
                pass
                
        # Match "> 15" or ">15" or "more than 15"
        greater_match = re.search(r'(?:>|more than|higher than|от)\s*([\d\.,]+)', text)
        if greater_match:
            try:
                threshold = float(greater_match.group(1).replace(',', '.'))
                return "Normal" if value > threshold else "Low"
            except ValueError:
                pass
                
        # Match "10 - 20" or "10-20"
        range_match = re.search(r'([\d\.,]+)\s*[-–]\s*([\d\.,]+)', text)
        if range_match:
            try:
                low = float(range_match.group(1).replace(',', '.'))
                high = float(range_match.group(2).replace(',', '.'))
                if value < low: return "Low"
                if value > high: return "High"
                return "Normal"
            except ValueError:
                pass

    return None

async def enrich_biomarkers_with_insights(
    biomarkers: list[BiomarkerResult],
) -> list[BiomarkerResult]:
    """Enrich biomarkers with AI clinical notes via semantic cache + LLM fallback.

    For each biomarker:
    1. Recalculates the flag deterministically.
    2. Performs a vector similarity lookup in the Supabase insights_cache table.
    3. Falls back to a bulk OpenAI call for cache misses.
    4. Writes new insights back to the cache asynchronously.

    Args:
        biomarkers: Mutable list of BiomarkerResult objects to enrich.

    Returns:
        The same list with `ai_clinical_note` and `flag` fields populated in-place.
    """
    import json

    supabase_client = await supabase_manager.get_client()
    llm_input: list[dict] = []

    # ── Phase 1: Flag recalculation & semantic cache lookup ──────────
    for idx, marker in enumerate(biomarkers):
        new_flag = recalculate_flag(marker.value_numeric, marker.reference_range)
        marker.flag = new_flag

        signature = f"{marker.original_name} - {new_flag}"
        emb_generator = embedding_model.embed([signature])
        query_emb = list(emb_generator)[0].tolist()

        rpc_response = None
        try:
            rpc_response = await supabase_client.rpc(
                "match_insights",
                {"query_embedding": query_emb, "match_threshold": 0.95, "match_count": 1},
            ).execute()
        except Exception as cache_err:
            logger.error("Semantic cache lookup failed for '%s': %s", signature, cache_err)

        if rpc_response and hasattr(rpc_response, "data") and len(rpc_response.data) > 0:
            cached_insight = rpc_response.data[0]
            marker.ai_clinical_note = cached_insight.get("ai_clinical_note", "")
            asyncio.create_task(
                supabase_client.table("insights_cache")
                .update({"hit_count": (cached_insight.get("hit_count") or 0) + 1})
                .eq("id", cached_insight["id"])
                .execute()
            )
        else:
            llm_input.append(
                {
                    "index": idx,
                    "name": marker.original_name,
                    "value": (
                        marker.value_numeric
                        if marker.value_numeric is not None
                        else marker.value_string
                    ),
                    "unit": marker.unit,
                    "flag": new_flag,
                    "reference_range": (
                        marker.reference_range.text if marker.reference_range else None
                    ),
                    "signature": signature,
                    "query_emb": query_emb,
                }
            )

    # ── Phase 2: Bulk LLM call for cache misses ──────────────────────
    if not llm_input:
        return biomarkers

    api_key = settings.openai_api_key
    model_name = settings.openai_model or "gpt-4o"
    if not api_key:
        logger.error("OPENAI_API_KEY is not configured — skipping LLM enrichment.")
        return biomarkers

    client = AsyncOpenAI(api_key=api_key, timeout=60.0)

    system_prompt = (
        "You are a medical lab expert for VITOGRAPH.\n"
        "For each biomarker provided, generate exactly 1 concise sentence in Russian "
        "(`ai_clinical_note`) explaining what this marker's current value means clinically.\n"
        "Focus on the recalculated flag."
    )

    # Structured Outputs schema — must not be modified to preserve strict mode.
    schema = {
        "type": "json_schema",
        "json_schema": {
            "name": "biomarker_notes",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "notes": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "index": {"type": "integer"},
                                "ai_clinical_note": {"type": "string"},
                            },
                            "required": ["index", "ai_clinical_note"],
                            "additionalProperties": False,
                        },
                    }
                },
                "required": ["notes"],
                "additionalProperties": False,
            },
        },
    }

    try:
        clean_llm_input = [
            {k: v for k, v in item.items() if k not in ("signature", "query_emb")}
            for item in llm_input
        ]

        completion = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Biomarkers to process:\n{clean_llm_input}"},
            ],
            response_format=schema,
            temperature=0.0,
        )

        llm_output = json.loads(completion.choices[0].message.content or "{}")
        notes_list: list[dict] = llm_output.get("notes", [])

        # ── Phase 3: Merge LLM results & write to cache ───────────────
        for item in llm_input:
            idx: int = item["index"]
            match = next((n for n in notes_list if n.get("index") == idx), None)
            note: str = match.get("ai_clinical_note", "") if match else ""

            if not note:
                note = "[Ошибка генерации]"

            biomarkers[idx].ai_clinical_note = note

            if note and note != "[Ошибка генерации]":
                asyncio.create_task(
                    supabase_client.table("insights_cache")
                    .insert(
                        {
                            "marker_signature": item["signature"],
                            "embedding": item["query_emb"],
                            "ai_clinical_note": note,
                        }
                    )
                    .execute()
                )

    except Exception as llm_err:
        logger.error("LLM enrichment error: %s", llm_err)
        # Graceful degradation: mark cache-miss markers as failed but keep others intact.
        for item in llm_input:
            if not biomarkers[item["index"]].ai_clinical_note:
                biomarkers[item["index"]].ai_clinical_note = "[Ошибка AI]"

    return biomarkers


@app.post("/refresh-notes", response_model=RefreshNotesResponse, tags=["integration"])
async def refresh_biomarker_notes(request: RefreshNotesRequest):
    """Recalculate flags and generate concise AI clinical notes for updated biomarkers."""
    if not request.biomarkers:
        return RefreshNotesResponse(markers=[])

    enriched_markers = await enrich_biomarkers_with_insights(request.biomarkers)

    result = [
        RefreshedMarker(
            index=idx,
            ai_clinical_note=marker.ai_clinical_note or "",
            flag=marker.flag,
        )
        for idx, marker in enumerate(enriched_markers)
    ]
    return RefreshNotesResponse(markers=result)


# ── Core Engine Endpoints (Phase 18) ─────────────────────────────────

@app.post("/parse", response_model=LabReportExtraction, tags=["file-parser"])
async def parse_lab_report(file: UploadFile = File(...)):
    """Upload PDF/DOCX/TXT -> Extract Biomarkers dynamically via AI."""
    filename = file.filename or "unknown.pdf"
    if not filename.endswith((".pdf", ".docx", ".txt")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Accepted: .pdf, .docx, .txt",
        )

    try:
        content = await file.read()
        parsed_data = await extract_biomarkers(content, filename)

        if not parsed_data.biomarkers:
            raise HTTPException(
                status_code=400,
                detail="Не удалось распознать медицинские показатели. Пожалуйста, загрузите четкое фото бланка анализов.",
            )


        return parsed_data
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Parsing error: {str(e)}")


@app.post("/parse-image", response_model=LabReportExtraction, tags=["file-parser"])
async def parse_lab_report_image(file: UploadFile = File(...)):
    """Upload a PHOTO of a lab report -> OCR via GPT-4o Vision -> Extract Biomarkers."""
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Expected an image file (JPEG, PNG, HEIC).",
        )

    content = await file.read()
    max_size = 10 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="Image too large. Max 10MB.")

    try:
        parsed_data = await extract_biomarkers_from_image(content, content_type)

        if not parsed_data.biomarkers:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Не удалось распознать показатели на фото. "
                    "Убедитесь, что бланк хорошо освещен и текст читаем."
                ),
            )


        return parsed_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Image parsing error: {str(e)}")


@app.post("/parse-image-batch", response_model=LabReportExtraction, tags=["file-parser"])
async def parse_lab_report_image_batch(files: List[UploadFile] = File(...)):
    """Upload a batch of PHOTOS (up to 10) of a lab report -> OCR via GPT-4o Vision -> Extract Biomarkers."""
    if len(files) > 10:
        raise HTTPException(
            status_code=400,
            detail="Too many files. Maximum 10 images allowed.",
        )

    images_data = []
    max_total_size = 50 * 1024 * 1024  # 50MB
    total_size = 0

    for file in files:
        content_type = file.content_type or ""
        if not content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail=f"Expected an image file, got '{content_type}' for {file.filename}.",
            )

        content = await file.read()
        total_size += len(content)
        if total_size > max_total_size:
            raise HTTPException(status_code=400, detail="Total size of images too large. Max 50MB.")

        images_data.append((content, content_type))

    if not images_data:
        raise HTTPException(status_code=400, detail="No valid images provided.")

    try:
        parsed_data = await extract_biomarkers_from_image_batch(images_data)

        if not parsed_data.biomarkers:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Не удалось распознать показатели на фото. "
                    "Убедитесь, что бланки хорошо освещены и текст читаем."
                ),
            )


        return parsed_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Batch image parsing error: {str(e)}")


@app.post("/calculate", response_model=NormResult, tags=["norm-engine"])
async def calculate_norm(biomarker: str, profile: UserProfile):
    """Calculate Dynamic Norm (Mock Logic)."""
    try:
        result = calculate_dynamic_norm(biomarker, profile)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Health Check ─────────────────────────────────────────────────────


@app.get(
    "/health",
    status_code=status.HTTP_200_OK,
    tags=["system"],
    summary="Health check",
)
async def health_check() -> dict[str, str]:
    """Return a simple health-check response."""
    return {"status": "healthy", "service": "vitograph-api"}
