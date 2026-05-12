import os
import requests
import json
from dotenv import load_dotenv

load_dotenv('apps/web/.env.local')
load_dotenv('apps/api/.env')

url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

if not url or not key:
    print("Missing Supabase credentials")
    exit(1)

headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json'
}

response = requests.get(f"{url}/rest/v1/push_subscriptions", headers=headers)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"Found {len(data)} subscriptions")
    print(json.dumps(data, indent=2))
else:
    print(response.text)
