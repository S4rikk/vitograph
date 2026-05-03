import os

# Set env vars BEFORE any app imports
os.environ["OPENAI_API_KEY"] = "test_key"
os.environ["SUPABASE_URL"] = "http://localhost"
os.environ["SUPABASE_KEY"] = "test_key"

# Force reload settings if already loaded
try:
    from apps.api.core.config import settings

    settings.openai_api_key = "test_key"
    settings.supabase_url = "http://localhost"
    settings.supabase_key = "test_key"
except ImportError:
    pass
