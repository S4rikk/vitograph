"""VITOGRAPH — FastAPI application entry point.

Initialises the FastAPI app with a lifespan handler that manages
the Supabase async client lifecycle.  Includes versioned routers
and a top-level health-check endpoint.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, List

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from api.v1.endpoints import analysis, analytics, norms, profiles, test_results, users
from core.database import supabase_manager
from services.file_parser import (
    LabReportExtraction,
    extract_biomarkers,
    extract_biomarkers_from_image,
    extract_biomarkers_from_image_batch,
)
from services.norm_engine import NormResult, UserProfile, calculate_dynamic_norm

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
                detail="Не удалось распознать медицинские показатели. Пожалуйста, загрузите четкое фото бланка анализов."
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
