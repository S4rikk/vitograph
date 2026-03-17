import asyncio
import httpx
import json

async def test_refresh_notes():
    url = "http://localhost:8000/refresh-notes"
    
    payload = {
        "biomarkers": [
            {
                "original_name": "Глюкоза",
                "standardized_slug": "glucose",
                "value_numeric": 10.5,
                "unit": "ммоль/л",
                "reference_range": {
                    "low": 3.3,
                    "high": 5.5,
                    "text": "3.3 - 5.5"
                }
            },
            {
                "original_name": "Витамин D",
                "standardized_slug": "vitamin_d",
                "value_numeric": 15.0,
                "unit": "нг/мл",
                "reference_range": {
                    "text": "> 30"
                }
            }
        ]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, timeout=30.0)
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_refresh_notes())
