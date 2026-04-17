import requests
import os
import time

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    # 1. Setup Document
    # Using README.md as a test document
    doc_path = os.path.abspath("README.md")
    print(f"--- Testing /setup with {doc_path} ---")
    setup_response = requests.post(f"{BASE_URL}/setup", params={"file_path": doc_path})
    print(f"Status Code: {setup_response.status_code}")
    print(f"Response: {setup_response.json()}")
    
    if setup_response.status_code != 200:
        print("Setup failed. Exiting.")
        return

    # 2. Ask Question
    print(f"\n--- Testing /ask ---")
    payload = {
        "question": "What is this project about?",
        "thread_id": "test_session"
    }
    ask_response = requests.post(f"{BASE_URL}/ask", json=payload)
    print(f"Status Code: {ask_response.status_code}")
    print(f"Response: {ask_response.json()}")

if __name__ == "__main__":
    test_api()
