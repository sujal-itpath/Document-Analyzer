import os
import sys

# Add the project root to the python path so it can find 'rag' and 'agent' modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
import shutil

# Import agent and vector store setup
from rag.vector_store import setup_vector_store
from agent.agent import run_agent, run_agent_stream
from app.history_manager import history_manager

# Global retriever initialized once at startup
retriever = None

# Ensure uploads directory exists
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(PROJECT_ROOT, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown events (modern FastAPI pattern)."""
    global retriever
    default_path = os.getenv("DEFAULT_DOC_PATH")
    if default_path and os.path.exists(default_path):
        try:
            retriever = setup_vector_store([default_path], overwrite=True)
            _ = retriever.invoke(" ")
            print(f"[API Startup] Loaded default document: {default_path}")
        except Exception as e:
            print(f"[API Startup] Failed to set up vector store: {e}")
    else:
        print("[API Startup] No default document provided. Call /upload to initialize.")
    yield  # App runs here
    # Shutdown logic (if any) goes here


app = FastAPI(title="Document Analysis Agent API", version="1.0", lifespan=lifespan)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QuestionRequest(BaseModel):
    question: str
    thread_id: Optional[str] = "session_1"


@app.post("/upload")
async def upload_documents(files: list[UploadFile] = File(...), overwrite: str = Form("true")):
    """Upload one or more documents, save them locally, and update the vector store."""
    global retriever
    is_overwrite = overwrite.lower() == "true"
    try:
        file_paths = []
        filenames = []
        for file in files:
            file_path = os.path.join(UPLOAD_DIR, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            file_paths.append(file_path)
            filenames.append(file.filename)

        # Initialize or update vector store with the uploaded files
        retriever = setup_vector_store(file_paths, overwrite=is_overwrite)
        _ = retriever.invoke(" ")

        return {
            "status": "ready",
            "message": f"Successfully uploaded and indexed {len(filenames)} document(s).",
            "filenames": filenames,
            "overwrite": overwrite
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/preview/{filename}")
async def get_preview(filename: str):
    """Serve the uploaded file for preview."""
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    # Set appropriate media type based on extension
    media_type = "application/octet-stream"
    if filename.endswith(".pdf"):
        media_type = "application/pdf"
    elif filename.endswith(".txt"):
        media_type = "text/plain"

    return FileResponse(file_path, media_type=media_type)


@app.get("/history")
async def get_history():
    """Get list of all chat sessions."""
    return await history_manager.get_all_sessions()


@app.get("/history/{thread_id}")
async def get_session_history(thread_id: str):
    """Get all messages for a specific session."""
    return await history_manager.get_session_messages(thread_id)


@app.post("/ask")
async def ask_question(request: QuestionRequest):
    """Stream the agent's response token by token."""
    global retriever
    if retriever is None:
        raise HTTPException(
            status_code=400,    
            detail="Vector store not initialized. Please upload a document first."
        )

    async def event_generator():
        try:
            async for token in run_agent_stream(request.question, thread_id=request.thread_id):
                yield token
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"Error: {str(e)}"

    return StreamingResponse(event_generator(), media_type="text/plain")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)