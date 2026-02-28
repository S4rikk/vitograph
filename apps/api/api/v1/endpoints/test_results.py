"""REST API endpoints for blood test sessions and results.

Allows users to upload a batch of biomarker measurements
grouped under a single test session, or upload a PDF lab report
for AI-powered extraction.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    status,
)

from core.database import get_supabase_client
from core.exceptions import DatabaseError, RecordNotFoundError
from repositories.test_result_repository import TestResultRepository
from schemas.test_result_schema import (
    TestSessionCreateRequest,
    TestSessionCreateResponse,
)
from services.pdf_service import (
    LLMParsingError,
    PDFExtractionError,
    PDFExtractorService,
)
from supabase import AsyncClient

router = APIRouter()

# ── Allowed MIME types for PDF uploads ───────────────────────────────
_PDF_CONTENT_TYPES = frozenset({"application/pdf", "application/x-pdf"})


# ── Dependencies ─────────────────────────────────────────────────────


def get_test_result_repo() -> TestResultRepository:
    """Provide a ``TestResultRepository`` instance via DI."""
    return TestResultRepository()


def get_pdf_extractor() -> PDFExtractorService:
    """Provide a ``PDFExtractorService`` instance via DI."""
    return PDFExtractorService()


DbClient = Annotated[AsyncClient, Depends(get_supabase_client)]
Repo = Annotated[TestResultRepository, Depends(get_test_result_repo)]
PdfSvc = Annotated[PDFExtractorService, Depends(get_pdf_extractor)]


# ── POST /test-results/{user_id} ────────────────────────────────────


@router.post(
    "/{user_id}",
    response_model=TestSessionCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload blood test results",
    description=(
        "Create a new test session for the given user and "
        "bulk-insert the associated biomarker measurements."
    ),
)
async def create_test_results(
    user_id: uuid.UUID,
    payload: TestSessionCreateRequest,
    db: DbClient,
    repo: Repo,
) -> TestSessionCreateResponse:
    """Upload a blood test session with one or more results.

    Args:
        user_id: UUID of the user profile.
        payload: Session metadata and list of biomarker values.
        db: Supabase async client (injected).
        repo: TestResultRepository (injected).

    Returns:
        Created session, list of saved results, and count.

    Raises:
        HTTPException 404: If the user profile does not exist.
        HTTPException 422: If the payload is malformed.
        HTTPException 500: On database errors.
    """
    try:
        data = await repo.create_session_with_results(
            db,
            user_id=str(user_id),
            test_date=payload.test_date.isoformat(),
            lab_name=payload.lab_name,
            notes=payload.notes,
            source=payload.source,
            results=[r.model_dump(mode="json") for r in payload.results],
        )
    except RecordNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile {user_id} not found",
        )
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )

    return TestSessionCreateResponse(
        session=data["session"],
        results=data["results"],
        results_count=len(data["results"]),
    )


# ── POST /test-results/{user_id}/upload-pdf ─────────────────────────


@router.post(
    "/{user_id}/upload-pdf",
    status_code=status.HTTP_200_OK,
    summary="Extract biomarkers from a PDF lab report",
    description=(
        "Upload a PDF lab report.  The backend extracts raw text "
        "using ``pypdf`` and then passes it through an LLM to "
        "produce structured biomarker data.  The response is "
        "returned to the frontend for user verification before "
        "actually saving to the database."
    ),
)
async def upload_pdf(
    user_id: uuid.UUID,
    file: UploadFile,
    db: DbClient,
    pdf_svc: PdfSvc,
) -> dict[str, Any]:
    """Extract biomarker data from an uploaded PDF.

    The extracted data is returned as-is for the user to review
    and confirm before it gets stored via the regular
    ``POST /{user_id}`` endpoint.

    Args:
        user_id: UUID of the user (for audit / future use).
        file: The uploaded PDF file.
        db: Supabase async client for fetching biomarkers.
        pdf_svc: PDF extractor service (injected).

    Returns:
        Dict with ``user_id``, ``filename``, ``pages_text``,
        and ``extracted_results`` (list of biomarker dicts).

    Raises:
        HTTPException 400: If the file is not a valid PDF or
            contains no extractable text.
        HTTPException 502: If the LLM call fails.
    """
    # ── Validate content type ────────────────────────────────────
    if file.content_type not in _PDF_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid file type: '{file.content_type}'. "
                "Only PDF files are accepted."
            ),
        )

    # ── Read file bytes ──────────────────────────────────────────
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # ── Extract text ─────────────────────────────────────────────
    try:
        extracted_text = pdf_svc.extract_text_from_pdf(file_bytes)
    except PDFExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # ── Fetch active biomarkers for context injection ────────────
    try:
        bio_resp = (
            await db.table("biomarkers")
            .select("id, code, name_en, name_ru, unit, aliases")
            .eq("is_active", True)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch biomarkers: {exc}",
        )

    active_biomarkers: list[dict[str, Any]] = bio_resp.data or []

    # ── Parse via LLM with context injection ─────────────────────
    try:
        parsed_results = await pdf_svc.parse_biomarkers_with_llm(
            extracted_text,
            active_biomarkers=active_biomarkers,
        )
    except LLMParsingError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    return {
        "user_id": str(user_id),
        "filename": file.filename,
        "pages_text": extracted_text,
        "extracted_results": parsed_results,
    }
