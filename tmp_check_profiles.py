
import asyncio
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv("apps/api/.env")

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # Use service role to see everything

async def check_profiles():
    supabase = create_client(url, key)
    response = supabase.table("profiles").select("*").execute()
    print(f"Found {len(response.data)} profiles")
    for profile in response.data:
        print(f"ID: {profile.get('id')}")
        print(f"Keys: {list(profile.keys())}")
        print("---")

if __name__ == "__main__":
    asyncio.run(check_profiles())
