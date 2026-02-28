"""Lab Report Storage — Supabase Storage upload for original files.

Uploads the original lab report file (PDF/DOCX/TXT) to the Supabase
Storage bucket `lab_reports` for permanent archival. No rotation is
applied — lab reports are stored indefinitely.
"""

import logging
from typing import Optional

from supabase import create_client

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────

BUCKET_NAME = "lab_reports"


# ── Public API ───────────────────────────────────────────────────────


def _resolve_content_type(filename: str) -> str:
    """Determine MIME type from filename extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    content_types = {
        "pdf": "application/pdf",
        "docx": (
            "application/vnd.openxmlformats-officedocument"
            ".wordprocessingml.document"
        ),
        "txt": "text/plain; charset=utf-8",
    }
    return content_types.get(ext, "application/octet-stream")


async def upload_lab_report(
    user_id: str,
    file_bytes: bytes,
    filename: str,
    token: str,
) -> Optional[str]:
    """Upload original lab report to Supabase Storage.

    Files are stored at: lab_reports/{user_id}/{timestamp}_{filename}

    Args:
        user_id: UUID of the authenticated user.
        file_bytes: Raw bytes of the uploaded file.
        filename: Original filename (e.g., "report.pdf").
        token: JWT access token for Supabase RLS.

    Returns:
        Public URL of the uploaded file, or None on failure.
    """
    import os
    import time

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_key:
        logger.error("[Storage] Missing SUPABASE_URL or SUPABASE_ANON_KEY")
        return None

    supabase = create_client(
        supabase_url,
        supabase_key,
        options=None,
    )
    supabase.postgrest.auth(token)

    timestamp = int(time.time())
    safe_filename = filename.replace(" ", "_")
    storage_path = f"{user_id}/{timestamp}_{safe_filename}"
    content_type = _resolve_content_type(filename)

    try:
        supabase.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )

        public_url_data = supabase.storage.from_(BUCKET_NAME).get_public_url(
            storage_path
        )

        logger.info(
            "[Storage] Uploaded lab report for user=%s: %s",
            user_id,
            storage_path,
        )
        return public_url_data

    except Exception as exc:
        logger.error(
            "[Storage] Failed to upload lab report for user=%s: %s",
            user_id,
            exc,
        )
        return None
