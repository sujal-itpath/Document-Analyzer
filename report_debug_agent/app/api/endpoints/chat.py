from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from agent.agent import run_agent_stream
from app.db.database import get_db, Document, User, ChatSession, Message, SessionLocal
from app.api.endpoints.auth import get_current_user
from app.services.chat_context import set_allowed_sources, reset_allowed_sources
from sqlalchemy.orm import Session
from rag.vector_store import get_retriever
import uuid
import json

router = APIRouter()

class QuestionRequest(BaseModel):
    question: str
    thread_id: Optional[str] = None
    document_ids: list[int] = []

class MessageResponse(BaseModel):
    role: str
    content: str
    timestamp: str

class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: str

class SessionDocumentResponse(BaseModel):
    id: int
    filename: str
    upload_date: str
    summary: Optional[str] = None
    suggestions: Optional[str] = None

class SessionDetailResponse(BaseModel):
    id: str
    title: str
    created_at: str
    document_ids: list[int]
    documents: list[SessionDocumentResponse]

class SessionMessagesResponse(BaseModel):
    messages: List[MessageResponse]
    document_ids: list[int]
    documents: list[SessionDocumentResponse]

class SessionDocumentsUpdateRequest(BaseModel):
    document_ids: list[int]

def _parse_document_ids(raw_document_ids: Optional[str]) -> list[int]:
    if not raw_document_ids:
        return []
    try:
        parsed = json.loads(raw_document_ids)
    except json.JSONDecodeError:
        return []
    return [int(doc_id) for doc_id in parsed if isinstance(doc_id, int) or str(doc_id).isdigit()]

def _serialize_document_ids(document_ids: list[int]) -> str:
    unique_ids: list[int] = []
    seen: set[int] = set()
    for doc_id in document_ids:
        doc_id = int(doc_id)
        if doc_id not in seen:
            seen.add(doc_id)
            unique_ids.append(doc_id)
    return json.dumps(unique_ids)

def _get_session_documents(db: Session, current_user: User, document_ids: list[int]) -> list[Document]:
    if not document_ids:
        return []
    return db.query(Document).filter(
        Document.owner_id == current_user.id,
        Document.id.in_(document_ids),
    ).all()

def _session_documents_payload(documents: list[Document]) -> list[SessionDocumentResponse]:
    return [
        SessionDocumentResponse(
            id=document.id,
            filename=document.filename,
            upload_date=document.upload_date.isoformat(),
            summary=document.summary,
            suggestions=document.suggestions,
        )
        for document in documents
    ]

def _resolve_session_document_ids(
    db: Session,
    session: ChatSession,
    current_user: User,
    requested_document_ids: list[int],
) -> list[int]:
    if requested_document_ids:
        valid_documents = _get_session_documents(db, current_user, requested_document_ids)
        valid_ids = [document.id for document in valid_documents]
        session.document_ids = _serialize_document_ids(valid_ids)
        db.add(session)
        db.commit()
        db.refresh(session)
        return valid_ids

    stored_ids = _parse_document_ids(session.document_ids)
    if stored_ids:
        return stored_ids

    fallback_documents = db.query(Document).filter(Document.owner_id == current_user.id).all()
    fallback_ids = [document.id for document in fallback_documents]
    if fallback_ids:
        session.document_ids = _serialize_document_ids(fallback_ids)
        db.add(session)
        db.commit()
        db.refresh(session)
    return fallback_ids

@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.created_at.desc()).all()
    return [{"id": s.id, "title": s.title, "created_at": s.created_at.isoformat()} for s in sessions]

@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session_detail(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    document_ids = _parse_document_ids(session.document_ids)
    documents = _get_session_documents(db, current_user, document_ids)
    ordered_documents = sorted(documents, key=lambda document: document_ids.index(document.id)) if document_ids else []
    return SessionDetailResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at.isoformat(),
        document_ids=document_ids,
        documents=_session_documents_payload(ordered_documents),
    )

@router.get("/sessions/{session_id}/messages", response_model=SessionMessagesResponse)
async def get_session_messages(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = db.query(Message).filter(Message.session_id == session_id).order_by(Message.timestamp.asc()).all()
    document_ids = _parse_document_ids(session.document_ids)
    documents = _get_session_documents(db, current_user, document_ids)
    ordered_documents = sorted(documents, key=lambda document: document_ids.index(document.id)) if document_ids else []

    return SessionMessagesResponse(
        messages=[MessageResponse(role=m.role, content=m.content, timestamp=m.timestamp.isoformat()) for m in messages],
        document_ids=document_ids,
        documents=_session_documents_payload(ordered_documents),
    )

@router.patch("/sessions/{session_id}/documents", response_model=SessionDetailResponse)
async def update_session_documents(
    session_id: str,
    request: SessionDocumentsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    documents = _get_session_documents(db, current_user, request.document_ids)
    valid_ids = [document.id for document in documents]
    session.document_ids = _serialize_document_ids(valid_ids)
    db.add(session)
    db.commit()
    db.refresh(session)

    ordered_documents = sorted(documents, key=lambda document: valid_ids.index(document.id)) if valid_ids else []
    return SessionDetailResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at.isoformat(),
        document_ids=valid_ids,
        documents=_session_documents_payload(ordered_documents),
    )

@router.post("/ask")
async def ask_question(
    request: QuestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    retriever = get_retriever()
    if retriever is None:
        raise HTTPException(
            status_code=400,
            detail="Vector store not initialized. Please upload a document first."
        )

    session = None
    session_id = request.thread_id
    if session_id:
        session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session_id = str(uuid.uuid4())
        session = ChatSession(
            id=session_id,
            user_id=current_user.id,
            title=request.question[:30] + ("..." if len(request.question) > 30 else ""),
            document_ids=_serialize_document_ids(request.document_ids),
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    session_document_ids = _resolve_session_document_ids(db, session, current_user, request.document_ids)
    session_documents = _get_session_documents(db, current_user, session_document_ids)
    ordered_documents = sorted(session_documents, key=lambda document: session_document_ids.index(document.id)) if session_document_ids else []
    allowed_sources = [document.file_path for document in ordered_documents]

    user_msg = Message(session_id=session_id, role="user", content=request.question)
    db.add(user_msg)
    db.commit()

    async def event_generator():
        token = set_allowed_sources(allowed_sources)
        try:
            file_context = ""
            if allowed_sources:
                file_context = "\n\n[SYSTEM INFO] Active documents for this chat session: " + ", ".join(allowed_sources)

            accumulated_response = ""
            async for chunk in run_agent_stream(request.question + file_context, thread_id=session_id):
                accumulated_response += chunk
                yield chunk

            agent_msg = Message(session_id=session_id, role="agent", content=accumulated_response)
            with SessionLocal() as async_db:
                async_db.add(agent_msg)
                async_db.commit()
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"Error: {str(e)}"
        finally:
            reset_allowed_sources(token)

    return StreamingResponse(event_generator(), media_type="text/plain", headers={"X-Session-ID": session_id})
