"""REST API endpoints for user feedback.

Handles submission of feedback/bug reports by the user, with anti-spam check.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Request
from supabase import AsyncClient

from core.database import get_supabase_client
from core.exceptions import DatabaseError
from schemas.feedback_schema import FeedbackCreate


logger = logging.getLogger(__name__)

router = APIRouter()

DbClient = Annotated[AsyncClient, Depends(get_supabase_client)]


@router.post(
    "/me/feedback",
    status_code=status.HTTP_201_CREATED,
    summary="Submit user feedback",
    description="Allows users to submit bugs or suggestions with rate-limiting (Anti-Spam).",
)
async def submit_feedback(
    payload: FeedbackCreate,
    db: DbClient,
    request: Request,
):
    """
    Inserts a feedback row into the db.
    Includes a 60-second rate-limit via checking the last submission time.
    """
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid authentication token required.",
        )
    jwt = token.replace("Bearer ", "")
    
    try:
        auth_response = await db.auth.get_user(jwt)
        user_id = auth_response.user.id
    except Exception as exc:
        logger.error(f"Failed to get auth user: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid authentication token required.",
        ) from exc

    try:
        # Anti-Spam Check: Get last record sorted by creation time
        # Suppress RLS issue because user is scoped via token
        last_feedback = (
            await db.table("feedback")
            .select("created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        if last_feedback.data:
            from datetime import datetime, timezone
            last_created = last_feedback.data[0]["created_at"]
            
            # Parse ISO8601 string from Supabase (e.g. 2024-03-10T15:20:00+00:00)
            if last_created.endswith('Z'):
                last_created = last_created[:-1] + '+00:00'
            last_time = datetime.fromisoformat(last_created)
            
            now = datetime.now(timezone.utc)
            diff = (now - last_time).total_seconds()
            
            if diff < 60:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Пожалуйста, подождите 1 минуту перед отправкой следующего отзыва.",
                )

        # Proceed with INSERT
        await db.table("feedback").insert({
            "user_id": user_id,
            "category": payload.category,
            "message": payload.message,
            "attachment_url": payload.attachment_url,
            "status": "new"
        }).execute()

        return {"status": "success"}

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Feedback insertion failed for user {user_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при сохранении обратной связи.",
        ) from exc
