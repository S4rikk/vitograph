import uuid
import jwt
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_supabase_syntax_fix():
    print("\n--- Testing Supabase Syntax Fix ---")
    random_id = uuid.uuid4()
    payload = {"weight_kg": 75.0}
    
    # This calls repo.update -> client.table(...).upsert(...).execute()
    # If the .select("*") was still there, this would crash.
    response = client.patch(f"/api/v1/profiles/{random_id}", json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.json()}")
    
    assert response.status_code == 404

def test_patch_me():
    print("\n--- Testing PATCH /me ---")
    user_id = str(uuid.uuid4())
    token = jwt.encode({"sub": user_id}, "dummy_secret", algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"weight_kg": 80.0}
    
    response = client.patch("/api/v1/profiles/me", json=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.json()}")
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Profile not found"

if __name__ == "__main__":
    try:
        test_supabase_syntax_fix()
    except Exception as e:
        print(f"FAILED test_supabase_syntax_fix: {e}")
        
    try:
        test_patch_me()
    except Exception as e:
        print(f"FAILED test_patch_me: {e}")
        
    print("\nVerification complete. If no 'AttributeError' or '500' was shown above, the syntax is fixed.")
