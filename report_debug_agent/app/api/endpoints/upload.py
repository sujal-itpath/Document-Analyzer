import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.database import get_db, Document as DBDocument, User
from app.api.endpoints.auth import get_current_user
from rag.vector_store import setup_vector_store
from app.services.document_processor import DocumentProcessor
from app.services.analyzer import DocumentAnalyzer
from app.services.google_docs_service import fetch_google_doc_text, extract_doc_id_from_url, list_google_docs

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
            
            # Check for name clash
            existing_doc = db.query(DBDocument).filter(
                DBDocument.owner_id == current_user.id,
                DBDocument.filename == file.filename
            ).first()
            
            if existing_doc and not is_overwrite:
                db.rollback()
                raise HTTPException(status_code=409, detail=f"A document named '{file.filename}' already exists.")
                
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Save to DB (or update if overwrite is true)
            if existing_doc and is_overwrite:
                db_doc = existing_doc
            else:
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

@router.post("/documents/google")
async def sync_google_doc(
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    name: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Syncs a Google Doc into the database and vector store."""
    try:
        # If the URL is just a raw ID without slashes, extract_doc_id_from_url will return the url
        doc_id = extract_doc_id_from_url(url)
        
        # Check if already synced
        existing_doc = db.query(DBDocument).filter(
            DBDocument.owner_id == current_user.id,
            DBDocument.google_doc_id == doc_id
        ).first()
        if existing_doc:
            raise HTTPException(status_code=409, detail="This Google Doc is already synced.")
        
        # Determine filename
        filename = f"{name}.txt" if name else f"GoogleDoc_{doc_id}.txt"
        
        # Check name clash
        name_clash = db.query(DBDocument).filter(
            DBDocument.owner_id == current_user.id,
            DBDocument.filename == filename
        ).first()
        if name_clash:
            raise HTTPException(status_code=409, detail=f"A document named '{filename}' already exists.")
        
        # Fetch the plain text from Google Drive API
        text_content = fetch_google_doc_text(current_user.id, doc_id)
        
        # Save it locally so the processor/vector store can handle it
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(text_content)
            
        # Save to DB
        db_doc = DBDocument(
            filename=filename,
            file_path=file_path,
            owner_id=current_user.id,
            google_doc_id=doc_id
        )
        db.add(db_doc)
        db.commit()
        
        # Analyze and Add to Vector Store
        try:
            background_tasks.add_task(analyzer.analyze, db_doc.id, text_content)
        except Exception as e:
            print(f"Failed to start analysis for Google Doc: {e}")
            
        setup_vector_store([file_path], overwrite=False)
        
        return {
            "status": "ready",
            "message": "Successfully synced Google Doc.",
            "filename": filename
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Google Doc Sync failed: {str(e)}")

@router.get("/documents/google/list")
async def get_google_docs_list(
    current_user: User = Depends(get_current_user)
):
    """Returns a list of Google Docs available to the user."""
    try:
        docs = list_google_docs(current_user.id)
        return {"documents": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list Google Docs: {str(e)}")

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
            "google_doc_id": d.google_doc_id
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
            
            # Delete from vector store
            persist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chroma_db")
            if os.path.exists(persist_dir):
                from langchain_chroma import Chroma
                from langchain_ollama import OllamaEmbeddings
                embeddings = OllamaEmbeddings(
                    base_url=settings.OLLAMA_BASE_URL,
                    model=settings.OLLAMA_EMBED_MODEL
                )
                vectorstore = Chroma(persist_directory=persist_dir, embedding_function=embeddings)
                vectorstore._collection.delete(where={"source": doc.file_path})
        except Exception as e:
            print(f"Warning: could not delete file or vector chunks {doc.file_path}: {e}")

    db.delete(doc)
    db.commit()
    return {"status": "deleted", "id": doc_id}

@router.get("/documents/{doc_id}/content")
async def get_document_content(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Serve the raw file content for a given document."""
    doc = db.query(DBDocument).filter(
        DBDocument.id == doc_id,
        DBDocument.owner_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Physical file not found on disk")

    return FileResponse(
        path=doc.file_path,
        headers={"Content-Disposition": f'inline; filename="{doc.filename}"'}
    )
