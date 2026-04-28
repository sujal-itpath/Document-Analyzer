import requests
import os

def test_upload():
    url = "http://localhost:8000/upload"
    file_path = "uploads/sample.txt"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return
        
    with open(file_path, 'rb') as f:
        files = {'files': f}
        data = {'overwrite': 'true'}
        try:
            response = requests.post(url, files=files, data=data, timeout=30)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.json()}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_upload()
