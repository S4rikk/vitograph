import httpx
import asyncio
import io

# Minimal valid PDF binary with "Ferritin: 50.5 ng/mL" content
# Constructed to be technically valid for pypdf
PDF_CONTENT = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n"
    b"2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n"
    b"3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 4 0 R\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 5 0 R\n>>\nendobj\n"
    b"4 0 obj\n<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\nendobj\n"
    b"5 0 obj\n<<\n/Length 55\n>>\nstream\n"
    b"BT\n/F1 24 Tf\n100 700 Td\n(Ferritin: 50.5 ng/mL) Tj\nET\n"
    b"endstream\nendobj\n"
    b"xref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000120 00000 n \n0000000280 00000 n \n0000000370 00000 n \n"
    b"trailer\n<<\n/Size 6\n/Root 1 0 R\n>>\nstartxref\n480\n%%EOF\n"
)

async def test_api():
    base_url = "http://localhost:8000"
    
    async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as client:
        print(f"Checking API at {base_url}...")

        # 1. Health/Root Check (Optional, but good to know if server is up)
        try:
            resp = await client.get("/docs")
            print(f"✅ Server is up (Docs status: {resp.status_code})")
        except Exception as e:
            print(f"❌ Server unreachable: {e}")
            return

        # 2. Test /calculate
        print("\n--- Testing /calculate ---")
        payload = {
            "age": 30, 
            "is_smoker": True, 
            "is_pregnant": False
        }
        params = {"biomarker": "Vitamin C"}
        
        resp = await client.post("/calculate", params=params, json=payload)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ Success: {data}")
            # Verify logic: Smoker should have higher range (Mock logic: +20%)
            # Base Vit C high is 2.0. Smoker should be 2.4.
            if data['high'] == 2.4:
                print("   Logic Verification: Passed (Smoker adjustment applied)")
            else:
                print(f"   Logic Verification: Failed (Expected high 2.4, got {data['high']})")
        else:
            print(f"❌ Failed: {resp.status_code} - {resp.text}")

        # 3. Test /parse
        print("\n--- Testing /parse ---")
        files = {"file": ("test.pdf", PDF_CONTENT, "application/pdf")}
        resp = await client.post("/parse", files=files)
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ Success: Parsed {len(data)} biomarkers")
            # Expect Ferritin
            ferritin = next((b for b in data if b['name'] == 'Ferritin'), None)
            if ferritin and ferritin['value'] == 50.5:
                print(f"   Content Verification: Passed (Found Ferritin: 50.5 {ferritin['unit']})")
            else:
                 print(f"   Content Verification: Failed. Data: {data}")
        else:
            print(f"❌ Failed: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    asyncio.run(test_api())
