import os
from typing import Iterable

from langchain_core.documents import Document

from app.services.chat_context import get_allowed_sources
from rag.vector_store import get_retriever

def _normalize_source_names(sources: Iterable[str] | None) -> set[str] | None:
    if not sources:
        return None
    normalized = {os.path.basename(source) for source in sources if source}
    return normalized or None

def filter_docs_by_allowed_sources(docs: list[Document]) -> list[Document]:
    allowed_sources = _normalize_source_names(get_allowed_sources())
    if not allowed_sources:
        return docs
    return [
        doc for doc in docs
        if os.path.basename(doc.metadata.get("source", "")) in allowed_sources
    ]

def search_docs(query: str, k: int = 15) -> list[Document]:
    retriever = get_retriever()
    if not retriever:
        return []

    vectorstore = getattr(retriever, "vectorstore", None)
    allowed_sources = get_allowed_sources() # These are now full paths

    if vectorstore is not None:
        if allowed_sources:
            matches: list[Document] = []
            for source_path in allowed_sources:
                try:
                    # Use exact match on full path if possible
                    # ChromaDB metadata filter for source
                    result = vectorstore.similarity_search(query, k=max(k, 20), filter={"source": source_path})
                except Exception as e:
                    print(f"Filter search failed for {source_path}: {e}")
                    result = []
                matches.extend(result)

            if matches:
                # Re-rank/sort by relevance if needed, but here we just dedup and take top k
                deduped: list[Document] = []
                seen_keys: set[tuple[str, str]] = set()
                for doc in matches:
                    key = (doc.metadata.get("source", ""), doc.page_content)
                    if key not in seen_keys:
                        seen_keys.add(key)
                        deduped.append(doc)
                
                # Sort by similarity would be better but we don't have scores here easily
                return deduped[:k]

            # Fallback if specific source search failed
            docs = vectorstore.similarity_search(query, k=max(k * 4, 40))
            filtered = filter_docs_by_allowed_sources(docs)
            return filtered[:k]

        return vectorstore.similarity_search(query, k=max(k, 15))

    # Standard retriever fallback
    docs = retriever.invoke(query)
    filtered = filter_docs_by_allowed_sources(docs)
    return filtered[:k]
