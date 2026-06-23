"""
Per-user long-term memory store backed by a dedicated ChromaDB collection.

Each user gets their own isolated collection: "user_memory_{user_id}".
Facts are embedded and stored with timestamp metadata so older facts can be
deprioritised or pruned in the future.

Design notes:
- Completely isolated from the document ChromaDB collection.
- Uses the same embedding model already configured in settings.
- Upserts facts by content hash so we never store duplicate facts.
- Thread-safe for FastAPI's async context (embeddings are synchronous but brief).
"""

import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import List, Optional

logger = logging.getLogger(__name__)

# ── Shared ChromaDB client (lazy-initialised) ─────────────────────────────────
_chroma_client = None
_embeddings = None

_MEMORY_PERSIST_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "chroma_memory_db",
)


def _get_client():
    global _chroma_client
    if _chroma_client is None:
        import chromadb
        _chroma_client = chromadb.PersistentClient(path=_MEMORY_PERSIST_DIR)
    return _chroma_client


def _get_embeddings():
    global _embeddings
    if _embeddings is None:
        from app.core.llm_factory import get_embeddings
        _embeddings = get_embeddings()
    return _embeddings


def _collection_name(user_id: int) -> str:
    return f"user_memory_{user_id}"


def _fact_id(fact: str) -> str:
    """Deterministic ID for deduplication — SHA-256 of the fact text."""
    return hashlib.sha256(fact.encode("utf-8")).hexdigest()[:32]


# ── Public API ────────────────────────────────────────────────────────────────

def save_memories(user_id: int, facts: List[str], source_session_id: Optional[str] = None) -> None:
    """
    Embed and upsert a list of fact strings into the user's memory collection.

    Duplicate facts (same text) are silently ignored via ID-based upsert.
    """
    if not facts:
        return

    try:
        client = _get_client()
        collection = client.get_or_create_collection(
            name=_collection_name(user_id),
            metadata={"hnsw:space": "cosine"},
        )
        embeddings = _get_embeddings()

        ids = [_fact_id(f) for f in facts]
        embeds = embeddings.embed_documents(facts)
        now = datetime.now(timezone.utc).isoformat()
        metadatas = [
            {"created_at": now, "session_id": source_session_id or ""}
            for _ in facts
        ]

        collection.upsert(
            ids=ids,
            embeddings=embeds,
            documents=facts,
            metadatas=metadatas,
        )
        logger.info("Memory: saved %d facts for user %d.", len(facts), user_id)
    except Exception as exc:
        logger.error("Memory: failed to save facts for user %d: %s", user_id, exc)


def retrieve_memories(user_id: int, query: str, k: int = 5) -> List[str]:
    """
    Retrieve the top-k most relevant facts for a query from the user's memory.

    Returns an empty list if no memories exist or on any error.
    """
    try:
        client = _get_client()
        existing = [c.name for c in client.list_collections()]
        if _collection_name(user_id) not in existing:
            return []

        collection = client.get_collection(name=_collection_name(user_id))
        if collection.count() == 0:
            return []

        embeddings = _get_embeddings()
        query_embed = embeddings.embed_query(query)

        results = collection.query(
            query_embeddings=[query_embed],
            n_results=min(k, collection.count()),
            include=["documents"],
        )
        facts = results.get("documents", [[]])[0]
        logger.debug("Memory: retrieved %d facts for user %d.", len(facts), user_id)
        return facts
    except Exception as exc:
        logger.error("Memory: retrieval failed for user %d: %s", user_id, exc)
        return []


def clear_memories(user_id: int) -> None:
    """Delete all memories for a user (for 'forget me' / GDPR use cases)."""
    try:
        client = _get_client()
        client.delete_collection(name=_collection_name(user_id))
        logger.info("Memory: cleared all facts for user %d.", user_id)
    except Exception as exc:
        logger.warning("Memory: could not clear facts for user %d: %s", user_id, exc)
