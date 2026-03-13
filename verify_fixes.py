import uuid
import jwt
from fastapi.testclient import TestClient
from apps.api.main import app

client = TestClient(app)

def test_supabase_syntax_fix():
    print("\n--- Testing Supabase Syntax Fix ---")
    # We'll try to PATCH a profile. Our logic for PATCH /me and PATCH /{user_id} 
    # both call repo.update, which had the syntax error.
    
    # We need a valid UUID for a user. Since we can't easily mock the DB here, 
    # we'll use a random UUID and expect a 404, but NOT an AttributeError.
    random_id = uuid.uuid4()
    payload = {"weight_kg": 75.0}
    
    response = client.patch(f"/api/v1/profiles/{random_id}", json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.json()}")
    
    # If the syntax error was still there, we'd get a 500 with AttributeError in traceback 
    # (or at least a 500 if our handler caught it). 
    # 404 means the logic reached the repository and the repository correctly 
    # tried to fetch/update but found nothing.
    assert response.status_code == 404

def test_patch_me():
    print("\n--- Testing PATCH /me ---")
    # Mock a JWT token
    user_id = str(uuid.uuid4())
    token = jwt.encode({"sub": user_id}, "secret", algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"weight_kg": 80.0}
    
    response = client.patch("/api/v1/profiles/me", json=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.json()}")
    
    # Expect 404 because the user doesn't exist in DB, but not 405 or 500
    assert response.status_code == 404
    assert response.json()["detail"] == "Profile not found"

if __name__ == "__main__":
    test_supabase_syntax_fix()
    test_patch_me()
    print("\nAll tests passed successfully (ignoring missing DB data)!")
