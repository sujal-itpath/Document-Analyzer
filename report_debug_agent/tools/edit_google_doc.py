from langchain_core.tools import tool
from app.services.google_docs_service import replace_text_in_doc
from langchain_core.runnables import RunnableConfig
from app.db.database import SessionLocal, ChatSession

@tool
def edit_google_doc(doc_url: str, target_text: str, replacement_text: str, config: RunnableConfig) -> str:
    """
    Use this tool to edit a Google Document. You can replace a specific string of text with a new string.
    
    Args:
        doc_url: The URL or ID of the Google Doc to edit.
        target_text: The exact text snippet you want to replace.
        replacement_text: The new text that will replace the target text.
    """
    thread_id = config.get("configurable", {}).get("thread_id")
    if not thread_id:
        return "Error: Cannot identify user session."
        
    db = SessionLocal()
    try:
        session = db.query(ChatSession).filter(ChatSession.id == thread_id).first()
        if not session:
            return "Error: Session not found."
            
        success = replace_text_in_doc(session.user_id, doc_url, target_text, replacement_text)
        if success:
            return f"Successfully replaced '{target_text}' with '{replacement_text}' in the Google Doc."
        else:
            return f"Failed to find the text '{target_text}' in the Google Doc. No changes were made."
    except Exception as e:
        return f"Error editing Google Doc: {str(e)}"
    finally:
        db.close()
