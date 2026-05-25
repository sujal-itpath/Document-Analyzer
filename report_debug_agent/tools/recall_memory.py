"""
recall_memory tool — retrieves relevant facts from the user's long-term memory.

The agent should call this at the start of a new conversation to orient itself
with any previously established context, user preferences, or document conclusions
from past sessions.
"""

import logging
from contextvars import ContextVar
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

# Injected by the chat endpoint before the agent runs (similar to allowed_sources)
_current_user_id: ContextVar[int | None] = ContextVar("current_user_id", default=None)


def set_current_user_id(user_id: int):
    return _current_user_id.set(user_id)


def reset_current_user_id(token):
    _current_user_id.reset(token)


@tool
def recall_memory(query: str) -> str:
    """
    Retrieve relevant facts about the user from previous chat sessions.

    Call this at the START of a new conversation to surface past user preferences,
    document conclusions, or important context established in earlier sessions.
    Do NOT call this for questions about document content — use search_document instead.

    Args:
        query: A short description of what context you are looking for.
               Example: "user preferences and past document analysis topics"

    Returns:
        Bullet-pointed facts from past sessions, or a message that no prior
        context exists yet.
    """
    user_id = _current_user_id.get()
    if user_id is None:
        return "No user context available."

    try:
        from rag.memory_store import retrieve_memories
        facts = retrieve_memories(user_id=user_id, query=query, k=5)

        if not facts:
            return "No past session context found for this user. This appears to be a fresh start."

        bullet_list = "\n".join(f"• {fact}" for fact in facts)
        return f"**Recalled from past sessions:**\n{bullet_list}"
    except Exception as exc:
        logger.error("recall_memory tool failed: %s", exc)
        return "Could not retrieve past session context due to an internal error."
