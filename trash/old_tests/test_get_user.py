import asyncio
import os
import sys

# To allow importing settings
sys.path.insert(0, os.path.abspath("c:/project/VITOGRAPH/apps/api"))

from supabase import create_async_client
from core.config import settings

async def main():
    client = await create_async_client(settings.supabase_url, settings.supabase_key)
    res = client.auth.get_user()
    print("Type without await:", type(res))
    
    try:
        res2 = await res
        print("Result with await:", type(res2))
    except Exception as e:
        print("Error with await:", type(e), e)

if __name__ == "__main__":
    asyncio.run(main())
