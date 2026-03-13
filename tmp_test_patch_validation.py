
import sys
import os

# Add apps/api to path
sys.path.append(os.path.abspath("apps/api"))

from schemas.profile_schema import ProfileRead
import uuid
import datetime

# Mock data from DB with extra keys
db_row = {
    "id": str(uuid.uuid4()),
    "display_name": "Test User",
    "updated_at": datetime.datetime.now().isoformat(),
    "created_at": datetime.datetime.now().isoformat(),
    "lifestyle_markers": {},
    "lab_diagnostic_reports": [],
    "active_nutrition_targets": {},
    "food_contraindication_zones": [],
    "is_smoker": False,
    "chronic_conditions": [],
    "medications": []
}

try:
    print("Testing ProfileRead.model_validate with extra fields...")
    profile = ProfileRead.model_validate(db_row)
    print("Validation successful!")
    print(profile.model_dump())
except Exception as e:
    print(f"Validation failed: {e}")
