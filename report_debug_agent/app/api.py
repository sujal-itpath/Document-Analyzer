import uvicorn
import os
import sys

# Redirect to the new modular structure
if __name__ == "__main__":
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)