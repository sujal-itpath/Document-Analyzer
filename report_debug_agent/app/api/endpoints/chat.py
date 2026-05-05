from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from agent.agent import run_agent_stream
from app.api.endpoints.upload import get_current_filenames
from rag.vector_store import get_retriever

router = APIRouter()

class QuestionRequest(BaseModel):
    question: str
    thread_id: Optional[str] = "session_1"

@router.post("/ask")
async def ask_question(request: QuestionRequest):
    """Stream the agent's response token by token."""
    retriever = get_retriever()
    if retriever is None:
        raise HTTPException(
            status_code=400,    
            detail="Vector store not initialized. Please upload a document first."
        )

    async def event_generator():
        try:
            current_filenames = get_current_filenames()
            file_context = f"\n\n[SYSTEM INFO] Currently loaded documents: {', '.join(current_filenames)}"
            
            async for token in run_agent_stream(request.question + file_context, thread_id=request.thread_id):
                yield token
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"Error: {str(e)}"

    return StreamingResponse(event_generator(), media_type="text/plain")
