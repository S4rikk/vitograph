import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as client:
        # Create a dummy payload
        files = {'audio_file': ('dummy.webm', b'fake audio data', 'audio/webm')}
        resp = await client.post('http://127.0.0.1:8001/api/v1/speech/transcribe', files=files)
        print("Status:", resp.status_code)
        print("Response:", resp.text)

if __name__ == "__main__":
    asyncio.run(test())
