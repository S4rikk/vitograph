"""REST API endpoints for user analytics and insights.

Exposes ``GET`` operations for micronutrient trends and lab testing schedule.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Annotated, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.database import get_supabase_client
from supabase import AsyncClient
from schemas.analytics_schema import MicronutrientTrendDay, LabScheduleItem

router = APIRouter()

DbClient = Annotated[AsyncClient, Depends(get_supabase_client)]

# ── GET /{user_id}/micronutrient-trends ──────────────────────────────

@router.get(
    "/{user_id}/micronutrient-trends",
    response_model=list[MicronutrientTrendDay],
    summary="Get micronutrient consumption trends",
    description="Aggregates micronutrients from meal logs over the past N days.",
)
async def get_micronutrient_trends(
    user_id: uuid.UUID,
    db: DbClient,
    days: int = Query(30, ge=1, le=90, description="Number of days to analyze"),
) -> list[Dict[str, Any]]:
    """Fetch and aggregate daily micronutrient intake."""
    cutoff_date = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)).isoformat()

    try:
        # Fetch meal logs for the user within the date range
        response = (
            await db.table("meal_logs")
            .select("logged_at, micronutrients")
            .eq("user_id", str(user_id))
            .gte("logged_at", cutoff_date)
            .order("logged_at", desc=False)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {exc}"
        )

    meals = response.data or []
    
    # Aggregate by date (YYYY-MM-DD)
    daily_aggregates: Dict[str, Dict[str, Any]] = {}
    
    for meal in meals:
        date_str = meal.get("logged_at")[:10]  # "2026-02-24"
        micros: Dict[str, float] = meal.get("micronutrients") or {}
        
        if date_str not in daily_aggregates:
            daily_aggregates[date_str] = {"date": date_str}
            
        for nutrient, value in micros.items():
            if nutrient not in daily_aggregates[date_str]:
                daily_aggregates[date_str][nutrient] = 0.0
            daily_aggregates[date_str][nutrient] += float(value)
            
    # Convert dict to sorted list
    sorted_dates = sorted(daily_aggregates.keys())
    result = [daily_aggregates[d] for d in sorted_dates]
    
    return result


# ── GET /{user_id}/lab-schedule ──────────────────────────────────────

@router.get(
    "/{user_id}/lab-schedule",
    response_model=list[LabScheduleItem],
    summary="Get recommended lab testing schedule",
    description="Generates test recommendations based on recent test dates and intake history.",
)
async def get_lab_schedule(
    user_id: uuid.UUID,
    db: DbClient,
) -> list[LabScheduleItem]:
    """Generate predictive lab schedule."""
    # MVP Heuristic approach: Check the most recent test results for core biomarkers
    
    try:
        # Fetch the most recent tests per marker (simplified - taking last 20 tests total)
        tests_response = (
            await db.table("test_results")
            .select("test_date, biomarkers(name_en, name_ru)")
            .eq("user_id", str(user_id))
            .order("test_date", desc=True)
            .limit(50)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {exc}"
        )

    tests = tests_response.data or []
    
    # Store most recent test date per biomarker name (ru)
    latest_tests = {}
    for t in tests:
        marker = (t.get("biomarkers") or {}).get("name_ru")
        date_str = t.get("test_date")
        if marker and date_str:
            if marker not in latest_tests:
                latest_tests[marker] = date_str
                
    now = datetime.datetime.now(datetime.timezone.utc).date()
    recommendations = []
    
    # Core markers to track for MVP
    core_markers = ["Ферритин", "Витамин D", "Витамин B12", "ТТГ"]
    
    for marker in core_markers:
        last_test_str = latest_tests.get(marker)
        
        if not last_test_str:
            recommendations.append(
                LabScheduleItem(
                    biomarker_name=marker,
                    status="due",
                    recommended_date=now,
                    rationale="Нет истории анализов по этому маркеру. Рекомендуется сдать для проверки базового уровня."
                )
            )
            continue
            
        last_test_date = datetime.date.fromisoformat(last_test_str[:10])
        days_since = (now - last_test_date).days
        
        if days_since > 180: # 6 months
            recommendations.append(
                LabScheduleItem(
                    biomarker_name=marker,
                    status="due",
                    recommended_date=now,
                    rationale=f"С момента последней сдачи прошло более 6 месяцев (сдавали {last_test_str[:10]}). Пора проверить динамику."
                )
            )
        elif days_since > 150: # 5 months
            recommendations.append(
                LabScheduleItem(
                    biomarker_name=marker,
                    status="upcoming",
                    recommended_date=last_test_date + datetime.timedelta(days=180),
                    rationale=f"Приближается плановая проверка (каждые 6 месяцев)."
                )
            )
        else:
            recommendations.append(
                LabScheduleItem(
                    biomarker_name=marker,
                    status="optimal",
                    recommended_date=last_test_date + datetime.timedelta(days=180),
                    rationale=f"Уровень проверен недавно ({last_test_str[:10]}). Следующая плановая проверка через полгода."
                )
            )
            
    return recommendations
