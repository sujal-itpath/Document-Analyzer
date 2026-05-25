"""
spaCy-based entity extractor for the Knowledge Graph.

Uses the lightweight en_core_web_sm model (12 MB, fully offline) to extract
named entities with typed labels (ORG, PERSON, DATE, MONEY, GPE, PRODUCT, etc.)
from document chunks and user queries.

The NLP model is loaded once as a module-level singleton to avoid reloading on
every call.
"""

import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# ── Singleton NLP model ───────────────────────────────────────────────────────
_nlp = None

# Entity labels we consider useful for the knowledge graph
_USEFUL_LABELS = {
    "ORG", "PERSON", "GPE", "PRODUCT", "DATE", "MONEY",
    "LAW", "EVENT", "WORK_OF_ART", "NORP", "FAC", "LOC",
}


def _get_nlp():
    """Lazy-load the spaCy model (only once per process)."""
    global _nlp
    if _nlp is None:
        try:
            import spacy
            _nlp = spacy.load("en_core_web_sm")
            logger.info("spaCy model loaded: en_core_web_sm")
        except Exception as exc:
            logger.error("Failed to load spaCy model: %s", exc)
            _nlp = None
    return _nlp


def extract(text: str) -> List[Dict[str, str]]:
    """
    Extract named entities from a text chunk.

    Returns
    -------
    list of dicts: [{"entity": str, "label": str}, ...]
        e.g. [{"entity": "ACME Corp", "label": "ORG"}, ...]
    """
    nlp = _get_nlp()
    if nlp is None or not text or not text.strip():
        return []

    # Truncate to avoid very long processing on giant chunks
    doc = nlp(text[:5000])
    seen = set()
    results = []
    for ent in doc.ents:
        if ent.label_ not in _USEFUL_LABELS:
            continue
        key = (ent.text.strip(), ent.label_)
        if key[0] and key not in seen:
            seen.add(key)
            results.append({"entity": ent.text.strip(), "label": ent.label_})

    return results


def extract_from_query(query: str) -> List[str]:
    """
    Extract entity strings from a user's query for graph lookup.

    Returns a flat list of entity strings (without labels).
    Falls back to splitting on whitespace if spaCy is unavailable.
    """
    nlp = _get_nlp()
    if nlp is None:
        # Naive fallback: return non-trivial words
        return [w for w in query.split() if len(w) > 3]

    doc = nlp(query[:500])
    entities = [ent.text.strip() for ent in doc.ents if ent.label_ in _USEFUL_LABELS]

    # If spaCy found nothing, fall back to noun chunks
    if not entities:
        entities = [chunk.text.strip() for chunk in doc.noun_chunks if len(chunk.text) > 2]

    return entities[:10]  # cap to avoid graph explosion
