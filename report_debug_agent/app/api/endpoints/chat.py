from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from agent.agent import run_agent_stream
from app.db.database import get_db, Document, User, ChatSession, Message, SessionLocal
from app.api.endpoints.auth import get_current_user
from sqlalchemy.orm import Session
from rag.vector_store import get_retriever
import uuid
import json

router = APIRouter()

class QuestionRequest(BaseModel):
    question: str
    thread_id: Optional[str] = None # Now acts as Session ID

class MessageResponse(BaseModel):
    role: str
    content: str
    timestamp: str

class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: str

@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.created_at.desc()).all()
    return [{"id": s.id, "title": s.title, "created_at": s.created_at.isoformat()} for s in sessions]

@router.get("/sessions/{session_id}/messages", response_model=List[MessageResponse])
async def get_session_messages(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    messages = db.query(Message).filter(Message.session_id == session_id).order_by(Message.timestamp.asc()).all()
    return [{"role": m.role, "content": m.content, "timestamp": m.timestamp.isoformat()} for m in messages]

@router.post("/ask")
async def ask_question(
    request: QuestionRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Stream the agent's response and persist to DB."""
    retriever = get_retriever()
    if retriever is None:
        raise HTTPException(
            status_code=400,    
            detail="Vector store not initialized. Please upload a document first."
        )

    # Initialize or find session
    session_id = request.thread_id
    if not session_id:
        session_id = str(uuid.uuid4())
        new_session = ChatSession(id=session_id, user_id=current_user.id, title=request.question[:30] + "...")
        db.add(new_session)
        db.commit()

    # Save user message
    user_msg = Message(session_id=session_id, role="user", content=request.question)
    db.add(user_msg)
    db.commit()

    async def event_generator():
        try:
            # Get context info
            docs = db.query(Document).filter(Document.owner_id == current_user.id).all()
            current_filenames = [d.filename for d in docs]
            file_context = f"\n\n[SYSTEM INFO] Currently loaded documents for user: {', '.join(current_filenames)}"
            
            accumulated_response = ""
            async for token in run_agent_stream(request.question + file_context, thread_id=session_id):
                accumulated_response += token
                yield token
            
            # Save agent message after stream completes
            agent_msg = Message(session_id=session_id, role="agent", content=accumulated_response)
            # We need a new session here because the generator runs outside the request scope usually
            with SessionLocal() as async_db:
                async_db.add(agent_msg)
                async_db.commit()
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"Error: {str(e)}"

    return StreamingResponse(event_generator(), media_type="text/plain", headers={"X-Session-ID": session_id})
