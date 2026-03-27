import http.client
import json
import os
import time
from dotenv import load_dotenv

def chat_with_gemini_3_pro():
    load_dotenv()
    api_key = os.getenv("GEMINI_API")
    
    if not api_key:
        print("[!] Error: GEMINI_API not found in .env")
        return

    host = "api.ourzhishi.top"
    endpoint = "/v1/chat/completions"
    model_id = "gemini-3.1-pro-preview-thinking"
    
    headers = {
        'Accept': 'application/json',
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    history = []
    print(f"--- Interactive chat with {model_id} ---")
    print(f"Host: {host}")
    print("Type 'exit' to quit.\n")

    while True:
        user_input = input("You: ")
        if user_input.lower() in ["exit", "quit", "output"]:
            break

        history.append({"role": "user", "content": user_input})
        
        payload = json.dumps({
            "temperature": 0.7,
            "messages": history,
            "model": model_id,
            "stream": False
        })

        print("Waiting for response...", end="", flush=True)
        try:
            start_time = time.time()
            
            conn = http.client.HTTPSConnection(host, timeout=60)
            conn.request("POST", endpoint, payload, headers)
            res = conn.getresponse()
            data = res.read().decode("utf-8")
            
            end_time = time.time()
            conn.close()

            total_time = end_time - start_time

            if res.status == 200:
                response_json = json.loads(data)
                content = response_json['choices'][0]['message']['content']
                history.append({"role": "assistant", "content": content})
                
                print(f"\r{model_id} [{total_time:.2f} sec]:")
                print(content)
                print("-" * 20)
            else:
                print(f"\r[ERROR] Status {res.status}: {data[:200]}")
                
        except Exception as e:
            print(f"\n[CONNECTION ERROR]: {e}")

if __name__ == "__main__":
    chat_with_gemini_3_pro()
