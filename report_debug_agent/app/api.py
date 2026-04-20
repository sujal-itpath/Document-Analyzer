from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
import os
import shutil

# Import agent and vector store setup
from rag.vector_store import setup_vector_store
from agent.agent import run_agent

app = FastAPI(title="Document Analysis Agent API", version="1.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global retriever initialized once at startup with a default document (can be reinitialized via endpoint if needed)
retriever = None

# Ensure uploads directory exists
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class QuestionRequest(BaseModel):
    question: str
    thread_id: Optional[str] = "session_1"

@app.on_event("startup")
async def startup_event():
    global retriever
    # Attempt to initialize with a default document path if exists
    default_path = os.getenv("DEFAULT_DOC_PATH")
    if default_path and os.path.exists(default_path):
        try:
            retriever = setup_vector_store([default_path])
            # Warm up retriever
            _ = retriever.invoke(" ")
        except Exception as e:
            print(f"[API Startup] Failed to set up vector store: {e}")
    else:
        print("[API Startup] No default document provided. Call /setup to initialize.")

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload a document, save it locally, and initialize the vector store."""
    global retriever
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Initialize vector store with the newly uploaded file
        retriever = setup_vector_store([file_path])
        # Verify indexing
        _ = retriever.invoke(" ")
        
        return {
            "status": "ready", 
            "message": f"Document {file.filename} uploaded and indexed successfully.",
            "filename": file.filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/setup")
async def setup_document(file_path: str):
    """Initialize the vector store with the given document path.
    The file must be accessible on the server file system.
    """
    global retriever
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail=f"File not found: {file_path}")
    try:
        retriever = setup_vector_store([file_path])
        # Verify indexing
        _ = retriever.invoke(" ")
        return {"status": "ready", "message": f"Document {os.path.basename(file_path)} indexed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ask")
async def ask_question(request: QuestionRequest):
    global retriever
    if retriever is None:
        raise HTTPException(status_code=400, detail="Vector store not initialized. Please upload a document first.")
    try:
        response = run_agent(request.question, thread_id=request.thread_id)
        return {"answer": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Allows running directly: python -m report_debug_agent.app.api
    uvicorn.run(app, host="0.0.0.0", port=8000)