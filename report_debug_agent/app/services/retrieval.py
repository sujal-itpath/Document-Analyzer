"""
Hybrid retrieval pipeline — 3-stage: BM25 + Vector → RRF merge → Cosine re-rank.

Stage 1 — Retrieve wide
    BM25 search  : exact keyword / token-level match  (k=40)
    Vector search: semantic embedding similarity       (k=40)

Stage 2 — Reciprocal Rank Fusion (RRF)
    Merges both ranked lists into a single deduplicated list.
    Score formula: Σ 1 / (rank + 60)  — standard RRF constant k=60.

Stage 3 — Cosine re-rank
    Uses the same Ollama embedding model to score every candidate against the
    original query embedding. Returns the top-8 by cosine similarity.

Source filtering is applied at Stage 1 so we never retrieve chunks from
documents outside the active chat session context.
"""

import logging
import os
from typing import List, Optional

import numpy as np
from langchain_core.documents import Document

from app.services.chat_context import get_allowed_sources
from rag.vector_store import get_retriever

logger = logging.getLogger(__name__)

# Final number of chunks returned to the agent
_FINAL_TOP_K = 8
# Wide retrieval count per source
_WIDE_K = 40


# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalize_source_names(sources) -> Optional[set]:
    if sources is None:
        return None
    return {os.path.basename(s) for s in sources if s}


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


def _doc_key(doc: Document) -> str:
    """Deduplication key: source path + first 120 chars of content."""
    return doc.metadata.get("source", "") + "|" + doc.page_content[:120]


def _rrf_merge(
    bm25_docs: List[Document],
    vector_docs: List[Document],
    k: int = 60,
) -> List[Document]:
    """
    Reciprocal Rank Fusion of two ranked lists.

    Returns a deduplicated list ordered by descending RRF score.
    """
    scores: dict[str, float] = {}
    doc_map: dict[str, Document] = {}

    for rank, doc in enumerate(bm25_docs):
        key = _doc_key(doc)
        scores[key] = scores.get(key, 0.0) + 1.0 / (rank + k)
        doc_map[key] = doc

    for rank, doc in enumerate(vector_docs):
        key = _doc_key(doc)
        scores[key] = scores.get(key, 0.0) + 1.0 / (rank + k)
        doc_map[key] = doc

    sorted_keys = sorted(scores, key=lambda x: scores[x], reverse=True)
    return [doc_map[key] for key in sorted_keys]


def _cosine_rerank(
    query: str,
    candidates: List[Document],
    top_k: int = _FINAL_TOP_K,
) -> List[Document]:
    """
    Re-rank candidates by cosine similarity of their embeddings to the query.

    Uses the configured Ollama embedding model — same model used for the vector
    store, so no extra downloads required.
    """
    if not candidates:
        return []

    try:
        from langchain_ollama import OllamaEmbeddings
        from app.core.config import settings

        embeddings_model = OllamaEmbeddings(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_EMBED_MODEL,
        )

        query_vec = embeddings_model.embed_query(query)
        candidate_texts = [doc.page_content for doc in candidates]
        candidate_vecs = embeddings_model.embed_documents(candidate_texts)

        scored = [
            (_cosine_similarity(query_vec, cvec), doc)
            for cvec, doc in zip(candidate_vecs, candidates)
        ]
        scored.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scored[:top_k]]

    except Exception as exc:
        logger.warning("Cosine re-ranking failed (%s) — returning RRF order.", exc)
        return candidates[:top_k]


# ── Public search function ────────────────────────────────────────────────────

def search_docs(query: str, k: int = _FINAL_TOP_K) -> List[Document]:
    """
    Full hybrid retrieval pipeline.

    1. BM25 keyword search        — wide retrieval
    2. Vector (ChromaDB) search   — wide retrieval
    3. RRF merge & deduplication
    4. Cosine re-rank             — return final top-k

    Source filtering is enforced throughout via the chat context.
    """
    allowed_sources = get_allowed_sources()  # set of full file paths or None

    # ── Stage 1a: BM25 ───────────────────────────────────────────────────────
    bm25_docs: List[Document] = []
    try:
        from rag import bm25_store
        bm25_docs = bm25_store.search(query, k=_WIDE_K, allowed_sources=allowed_sources)
        logger.debug("BM25 returned %d docs.", len(bm25_docs))
    except Exception as exc:
        logger.warning("BM25 search failed: %s", exc)

    # ── Stage 1b: Vector search ───────────────────────────────────────────────
    vector_docs: List[Document] = []
    retriever = get_retriever()
    if retriever is not None:
        vectorstore = getattr(retriever, "vectorstore", None)
        if vectorstore is not None:
            try:
                if allowed_sources is not None:
                    if not allowed_sources:
                        # Explicitly empty — block all results
                        return []
                    # Search per source and merge
                    for source_path in allowed_sources:
                        try:
                            results = vectorstore.similarity_search(
                                query,
                                k=_WIDE_K,
                                filter={"source": source_path},
                            )
                            vector_docs.extend(results)
                        except Exception as exc:
                            logger.warning("Vector search failed for %s: %s", source_path, exc)
                else:
                    vector_docs = vectorstore.similarity_search(query, k=_WIDE_K)

                logger.debug("Vector search returned %d docs.", len(vector_docs))
            except Exception as exc:
                logger.warning("Vector search failed: %s", exc)
        else:
            # Standard retriever fallback
            try:
                vector_docs = retriever.invoke(query)
                # Apply source filter manually
                if allowed_sources is not None:
                    allowed_bases = _normalize_source_names(allowed_sources)
                    vector_docs = [
                        d for d in vector_docs
                        if os.path.basename(d.metadata.get("source", "")) in (allowed_bases or set())
                    ]
            except Exception as exc:
                logger.warning("Retriever fallback failed: %s", exc)

    # ── Stage 2: RRF merge ────────────────────────────────────────────────────
    merged = _rrf_merge(bm25_docs, vector_docs)
    logger.debug("After RRF merge: %d unique candidates.", len(merged))

    if not merged:
        return []

    # ── Stage 3: Cosine re-rank ───────────────────────────────────────────────
    final = _cosine_rerank(query, merged, top_k=k)
    logger.debug("After cosine re-rank: %d docs returned.", len(final))
    return final


# ── Kept for backward compatibility ──────────────────────────────────────────

def filter_docs_by_allowed_sources(docs: List[Document]) -> List[Document]:
    """Legacy helper — kept for any direct callers outside the main pipeline."""
    allowed_sources = get_allowed_sources()
    if allowed_sources is None:
        return docs
    allowed_bases = _normalize_source_names(allowed_sources)
    return [
        doc for doc in docs
        if os.path.basename(doc.metadata.get("source", "")) in (allowed_bases or set())
    ]
