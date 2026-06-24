"""
Background memory consolidation service.

After the first agent response in any new chat session, this module is invoked
as a FastAPI BackgroundTask. It:
  1. Reads the last N messages from the session.
  2. Prompts the local Ollama LLM to extract 3–7 concise facts.
  3. Saves those facts to the user's long-term memory (ChromaDB + SQL).

This runs entirely out-of-band — users feel zero latency impact.
"""

import json
import logging
import re
from typing import Optional

from sqlalchemy.orm import Session as DBSession

logger = logging.getLogger(__name__)

# Max messages to consider when extracting facts
_MAX_MESSAGES = 20

_EXTRACTION_PROMPT = """You are a memory extraction assistant. Read the conversation below and extract 3 to 7 concise, useful facts about the user. Focus on:
- The user's role, preferences, or working style
- Important conclusions they reached about documents
- Key entities they care about (company names, project names, dates)
- Any explicit preferences they stated (e.g. "I prefer bullet points")

Output ONLY a valid JSON array of strings. Each string is one fact.
Example: ["User is a financial analyst.", "User prefers bullet-point responses.", "User analyzed the ACME Q4 2024 report."]

Do not include filler facts. If there is nothing useful, output an empty array: []

CONVERSATION:
{conversation}

JSON array:"""


def _build_conversation_text(messages) -> str:
    lines = []
    for msg in messages:
        role = "User" if msg.role == "user" else "Agent"
        # Truncate very long agent responses to avoid token overflow
        content = msg.content[:800] if len(msg.content) > 800 else msg.content
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def _extract_json_array(text: str) -> list:
    """Robustly extract a JSON array from the LLM's response."""
    # Try direct parse
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Try extracting the first [...] block
    match = re.search(r'\[.*?\]', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return []


def consolidate_session(
    session_id: str,
    user_id: int,
    db_url: Optional[str] = None,
) -> None:
    """
    Extract and save long-term memory facts from a chat session.

    This function is safe to call from a BackgroundTask — it creates its own
    DB session and LLM client so it doesn't share state with the request.
    """
    try:
        # ── 1. Load recent messages from DB ──────────────────────────────────
        from app.db.database import SessionLocal, Message, ChatSession, UserMemoryFact
        import datetime

        with SessionLocal() as db:
            messages = (
                db.query(Message)
                .filter(Message.session_id == session_id)
                .order_by(Message.timestamp.desc())
                .limit(_MAX_MESSAGES)
                .all()
            )
            messages = list(reversed(messages))  # chronological order

        if len(messages) < 2:
            logger.debug("Memory consolidation: too few messages in session %s, skipping.", session_id)
            return

        # ── 2. Build conversation text ────────────────────────────────────────
        conversation_text = _build_conversation_text(messages)

        # ── 3. Call LLM for fact extraction ────────────────────────────
        from app.core.llm_factory import get_chat_model

        llm = get_chat_model(temperature=0)

        prompt = _EXTRACTION_PROMPT.format(conversation=conversation_text)
        response = llm.invoke(prompt)
        raw_text = response.content if hasattr(response, "content") else str(response)

        facts = _extract_json_array(raw_text)
        facts = [f.strip() for f in facts if isinstance(f, str) and f.strip()]

        if not facts:
            logger.debug("Memory consolidation: no facts extracted for session %s.", session_id)
            return

        logger.info("Memory consolidation: extracted %d facts for user %d.", len(facts), user_id)

        # ── 4. Save to ChromaDB memory store ──────────────────────────────────
        from rag.memory_store import save_memories
        save_memories(user_id, facts, source_session_id=session_id)

        # ── 5. Also persist to SQL for auditability ───────────────────────────
        with SessionLocal() as db:
            for fact_text in facts:
                fact_row = UserMemoryFact(
                    user_id=user_id,
                    fact_text=fact_text,
                    source_session_id=session_id,
                    created_at=datetime.datetime.utcnow(),
                )
                db.add(fact_row)
            db.commit()

        logger.info("Memory consolidation: done for session %s.", session_id)

    except Exception as exc:
        logger.error("Memory consolidation failed for session %s: %s", session_id, exc, exc_info=True)
