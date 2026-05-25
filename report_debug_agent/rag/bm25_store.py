"""
BM25 keyword index for hybrid retrieval.

Maintains a token-level BM25Okapi index over all indexed document chunks.
Persists the corpus to disk as a JSON sidecar so the index survives restarts
without requiring re-processing of documents.
"""

import os
import json
import logging
from typing import List, Optional

from langchain_core.documents import Document

logger = logging.getLogger(__name__)

_CORPUS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "bm25_corpus.json",
)

# ── Internal state ────────────────────────────────────────────────────────────
_corpus: List[dict] = []   # [{text, source, metadata}, ...]
_bm25 = None               # BM25Okapi instance (lazy-built)
_dirty = False             # True when corpus changed but index not rebuilt


def _tokenize(text: str) -> List[str]:
    """Simple whitespace + lowercase tokenizer."""
    return text.lower().split()


def _build_index() -> None:
    global _bm25, _dirty
    try:
        from rank_bm25 import BM25Okapi
    except ImportError:
        logger.warning("rank_bm25 not installed — BM25 search disabled.")
        return

    if not _corpus:
        _bm25 = None
        return

    tokenized = [_tokenize(item["text"]) for item in _corpus]
    _bm25 = BM25Okapi(tokenized)
    _dirty = False
    logger.debug("BM25 index rebuilt over %d chunks.", len(_corpus))


def add_chunks(chunks: List[Document]) -> None:
    """Add document chunks to the BM25 corpus and schedule a rebuild."""
    global _dirty
    for chunk in chunks:
        _corpus.append({
            "text": chunk.page_content,
            "source": chunk.metadata.get("source", ""),
            "metadata": chunk.metadata,
        })
    _dirty = True
    _build_index()
    _save()


def remove_by_source(file_path: str) -> None:
    """Remove all chunks belonging to a file path and rebuild the index."""
    global _corpus, _dirty
    before = len(_corpus)
    _corpus = [item for item in _corpus if item["source"] != file_path]
    if len(_corpus) != before:
        _dirty = True
        _build_index()
        _save()
        logger.info("BM25: removed %d chunks for source '%s'.", before - len(_corpus), file_path)


def search(query: str, k: int = 40, allowed_sources: Optional[set] = None) -> List[Document]:
    """
    Return up to k Document objects ranked by BM25 score.

    Parameters
    ----------
    query          : user query string
    k              : maximum results
    allowed_sources: if provided, only return chunks from these full file paths
    """
    global _dirty
    if _dirty:
        _build_index()

    if _bm25 is None or not _corpus:
        return []

    tokenized_query = _tokenize(query)
    scores = _bm25.get_scores(tokenized_query)

    # Build (score, index) pairs filtered by source
    ranked = sorted(
        (
            (score, idx)
            for idx, score in enumerate(scores)
            if allowed_sources is None or _corpus[idx]["source"] in allowed_sources
        ),
        key=lambda x: x[0],
        reverse=True,
    )

    results = []
    for score, idx in ranked[:k]:
        if score <= 0:
            break
        item = _corpus[idx]
        results.append(Document(page_content=item["text"], metadata=item["metadata"]))

    return results


def _save() -> None:
    """Persist the corpus to disk."""
    try:
        with open(_CORPUS_PATH, "w", encoding="utf-8") as f:
            json.dump(_corpus, f, ensure_ascii=False)
    except Exception as exc:
        logger.warning("BM25: could not save corpus: %s", exc)


def load() -> None:
    """Load corpus from disk and rebuild the index. Called once at startup."""
    global _corpus
    if os.path.exists(_CORPUS_PATH):
        try:
            with open(_CORPUS_PATH, "r", encoding="utf-8") as f:
                _corpus = json.load(f)
            _build_index()
            logger.info("BM25: loaded %d chunks from disk.", len(_corpus))
        except Exception as exc:
            logger.warning("BM25: failed to load corpus: %s", exc)
            _corpus = []


# Auto-load on import
load()
