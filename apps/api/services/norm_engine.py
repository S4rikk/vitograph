"""Norm Engine — Mock implementation of Dynamic Norm Logic.

Calculates personalized reference ranges based on user profile factors.
"""

from typing import Optional
from pydantic import BaseModel

# ── Schemas ──────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    age: int
    gender: str = "male"
    stress_level: str = "low"  # low, moderate, high, very_high
    activity_level: str = "sedentary" # sedentary, light, moderate, active, very_active
    diet_type: str = "omnivore" # omnivore, vegetarian, vegan, pescatarian, keto, other
    environment_aqi: int = 50 
    lab_deficiencies: list[str] = []
    is_smoker: bool = False
    is_pregnant: bool = False

class NormResult(BaseModel):
    biomarker: str
    low: float
    high: float
    unit: str
    reason: str

# ── Constants ────────────────────────────────────────────────────────

BASE_RANGES = {
    "Vitamin C": {"low": 0.4, "high": 2.0, "unit": "mg/dL"},
    "Ferritin": {"low": 30.0, "high": 200.0, "unit": "ng/mL"},
    "Vitamin D": {"low": 30.0, "high": 100.0, "unit": "ng/mL"},
    "Iron": {"low": 10.0, "high": 30.0, "unit": "umol/L"},
    "Calcium": {"low": 8.5, "high": 10.5, "unit": "mg/dL"},
    "Magnesium": {"low": 1.7, "high": 2.2, "unit": "mg/dL"},
    "Zinc": {"low": 60.0, "high": 120.0, "unit": "mcg/dL"},
    "Potassium": {"low": 3.6, "high": 5.2, "unit": "mEq/L"},
    "Sodium": {"low": 135.0, "high": 145.0, "unit": "mEq/L"},
    "Vitamin B12": {"low": 200.0, "high": 900.0, "unit": "pg/mL"},
    "Folate": {"low": 4.0, "high": 20.0, "unit": "ng/mL"},
    "Selenium": {"low": 40.0, "high": 120.0, "unit": "mcg/L"},
    "Cortisol": {"low": 6.0, "high": 23.0, "unit": "mcg/dL"},
    "Omega-3": {"low": 8.0, "high": 12.0, "unit": "%"},
    "Testosterone": {"low": 300.0, "high": 1000.0, "unit": "ng/dL"}
}

# ── Service ──────────────────────────────────────────────────────────

def calculate_dynamic_norm(biomarker_name: str, profile: UserProfile) -> NormResult:
    """Calculate personalized norms based on profile factors (Mock Logic)."""
    
    base = BASE_RANGES.get(biomarker_name)
    if not base:
        raise ValueError(f"Unknown biomarker: {biomarker_name}")

    low = base["low"]
    high = base["high"]
    unit = base["unit"]
    reasons = ["Base range"]

    # 1. Environment: AQI > 100
    if profile.environment_aqi > 100:
        if biomarker_name == "Vitamin C":
            low *= 1.3
            reasons.append("High AQI adjustment (+30% min)")
        elif biomarker_name == "Omega-3":
            low *= 1.15
            reasons.append("High AQI adjustment (+15% min)")

    # 2. Stress / Burnout
    if profile.stress_level in ("high", "very_high"):
        if biomarker_name == "Magnesium":
            low *= 1.25
            reasons.append("High stress adjustment (+25% min)")
        elif biomarker_name == "Cortisol":
            high *= 1.20
            reasons.append("High stress tolerance (+20% max)")

    # 3. Diet: Keto
    if profile.diet_type == "keto":
        if biomarker_name == "Sodium":
            low += 10.0
            high += 10.0
            reasons.append("Keto diet adjustment (+10 mEq/L)")
        elif biomarker_name == "Magnesium":
            low *= 1.10
            reasons.append("Keto diet adjustment (+10% min)")

    # 4. Activity Level & Gender
    if profile.activity_level in ("active", "very_active") and profile.gender == "male":
        if biomarker_name == "Testosterone":
            low = max(low, 400.0)
            reasons.append("High activity male adjustment (min 400 ng/dL)")

    # 5. Lab Deficiencies (Cofactors)
    if "Vitamin D deficiency" in profile.lab_deficiencies:
        if biomarker_name == "Magnesium":
            low *= 1.20
            reasons.append("Vitamin D deficiency cofactor (+20% min)")

    # Keep legacy mock logic for backward compatibility if needed, though they weren't in the new list:
    if biomarker_name == "Vitamin C" and profile.is_smoker:
        low *= 1.2
        high *= 1.2
        reasons.append("Smoker adjustment (+20%)")
    if biomarker_name == "Ferritin" and profile.is_pregnant:
        low *= 0.9
        high *= 0.9
        reasons.append("Pregnancy adjustment (-10%)")

    return NormResult(
        biomarker=biomarker_name,
        low=round(low, 2),
        high=round(high, 2),
        unit=unit,
        reason="; ".join(reasons)
    )
