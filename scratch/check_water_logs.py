import os
import requests
import json
from dotenv import load_dotenv

load_dotenv('apps/web/.env.local')
load_dotenv('apps/api/.env')

url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json'
}

response = requests.get(f"{url}/rest/v1/water_logs?select=*&order=logged_at.desc&limit=5", headers=headers)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    print(json.dumps(response.json(), indent=2))
else:
    print(response.text)
