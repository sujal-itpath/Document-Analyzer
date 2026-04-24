import requests
import os

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    # 1. Upload Document
    doc_path = "uploads/sample.txt"
    print(f"--- Testing /upload with {doc_path} ---")
    with open(doc_path, "rb") as f:
        files = {"file": (os.path.basename(doc_path), f, "text/plain")}
        upload_response = requests.post(f"{BASE_URL}/upload", files=files)
    
    print(f"Status Code: {upload_response.status_code}")
    print(f"Response: {upload_response.json()}")
    
    if upload_response.status_code != 200:
        print("Upload failed. Exiting.")
        return

    # 2. Ask Question (Summarize)
    print(f"\n--- Testing /ask (Summary) ---")
    payload = {
        "question": "Can you provide a brief summary of the document?",
        "thread_id": "test_session_gemini"
    }
    # Using stream=True because it's a StreamingResponse
    ask_response = requests.post(f"{BASE_URL}/ask", json=payload, stream=True)
    print(f"Status Code: {ask_response.status_code}")
    
    print("Response: ", end="", flush=True)
    for chunk in ask_response.iter_content(chunk_size=None):
        if chunk:
            print(chunk.decode(), end="", flush=True)
    print("\n")

if __name__ == "__main__":
    test_api()
