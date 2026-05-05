import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.core.config import settings
from rag.vector_store import setup_vector_store

router = APIRouter()

# Store current filenames in a simple state (could be moved to a more robust state manager)
current_filenames = []

@router.post("/upload")
async def upload_documents(files: list[UploadFile] = File(...), overwrite: str = Form("true")):
    """Upload one or more documents, save them locally, and update the vector store."""
    global current_filenames
    is_overwrite = overwrite.lower() == "true"
    
    try:
        file_paths = []
        filenames = []
        for file in files:
            file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            file_paths.append(file_path)
            filenames.append(file.filename)

        # Initialize or update vector store with the uploaded files
        setup_vector_store(file_paths, overwrite=is_overwrite)

        if is_overwrite:
            current_filenames = filenames
        else:
            current_filenames = list(set(current_filenames + filenames))

        return {
            "status": "ready",
            "message": f"Successfully uploaded and indexed {len(filenames)} document(s).",
            "filenames": filenames,
            "overwrite": is_overwrite
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

def get_current_filenames():
    return current_filenames
