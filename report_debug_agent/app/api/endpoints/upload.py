import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.database import get_db, Document as DBDocument, User
from app.api.endpoints.auth import get_current_user
from rag.vector_store import setup_vector_store
from app.services.document_processor import DocumentProcessor
from app.services.analyzer import DocumentAnalyzer

router = APIRouter()
analyzer = DocumentAnalyzer()
processor = DocumentProcessor()

@router.post("/upload")
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...), 
    overwrite: str = Form("true"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload one or more documents, save them locally, and update the vector store."""
    is_overwrite = overwrite.lower() == "true"
    
    try:
        file_paths = []
        filenames = []
        for file in files:
            file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Save to DB
            db_doc = DBDocument(
                filename=file.filename,
                file_path=file_path,
                owner_id=current_user.id
            )
            db.add(db_doc)
            file_paths.append(file_path)
            filenames.append(file.filename)
            db.flush() # Get the ID for the document
            
            # Extract text for analysis
            try:
                extracted_docs = processor.process_document(file_path)
                if extracted_docs:
                    full_text = "\n".join([d.page_content for d in extracted_docs])
                    background_tasks.add_task(analyzer.analyze, db_doc.id, full_text)
            except Exception as e:
                print(f"Failed to start analysis for {file.filename}: {e}")

        db.commit()

        # Initialize or update vector store with the uploaded files
        setup_vector_store(file_paths, overwrite=is_overwrite)

        return {
            "status": "ready",
            "message": f"Successfully uploaded and indexed {len(filenames)} document(s).",
            "filenames": filenames,
            "overwrite": is_overwrite
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/documents")
async def get_user_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all documents uploaded by the current user."""
    docs = db.query(DBDocument).filter(DBDocument.owner_id == current_user.id).order_by(DBDocument.upload_date.desc()).all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "upload_date": d.upload_date,
            "summary": d.summary,
            "suggestions": d.suggestions,
        }
        for d in docs
    ]


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a document record and its uploaded file."""
    doc = db.query(DBDocument).filter(
        DBDocument.id == doc_id,
        DBDocument.owner_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove physical file if it exists
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError as e:
            print(f"Warning: could not delete file {doc.file_path}: {e}")

    db.delete(doc)
    db.commit()
    return {"status": "deleted", "id": doc_id}
