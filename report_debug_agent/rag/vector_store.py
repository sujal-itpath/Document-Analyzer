"""
Document vector store — ChromaDB backed by Ollama embeddings.

Changes from original:
- chunk_size reduced to 600 (overlap 120) for higher precision
- MarkdownHeaderTextSplitter applied first for .md / .txt files
- Every chunk metadata enriched with section_header and page fields
- After indexing, BM25 store is updated in sync
- On delete, BM25 store is pruned
"""

import os
import shutil
import logging
from typing import List, Optional

from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings

from app.services.document_processor import DocumentProcessor
from app.core.config import settings
from rag import bm25_store

load_dotenv()
logger = logging.getLogger(__name__)

_retriever = None

# ── Splitter configuration ────────────────────────────────────────────────────
_CHUNK_SIZE = 600
_CHUNK_OVERLAP = 120


def _get_embeddings() -> OllamaEmbeddings:
    return OllamaEmbeddings(
        base_url=settings.OLLAMA_BASE_URL,
        model=settings.OLLAMA_EMBED_MODEL,
    )


def _split_documents(docs: List[Document], file_path: str) -> List[Document]:
    """
    Tier-1: MarkdownHeaderTextSplitter for .md / .txt files.
    Tier-2: RecursiveCharacterTextSplitter for everything else.
    Enriches every chunk with section_header metadata where available.
    """
    ext = os.path.splitext(file_path)[1].lower()

    splits: List[Document] = []

    if ext in (".md", ".txt"):
        try:
            from langchain_text_splitters import MarkdownHeaderTextSplitter

            headers_to_split_on = [
                ("#", "h1"),
                ("##", "h2"),
                ("###", "h3"),
            ]
            md_splitter = MarkdownHeaderTextSplitter(
                headers_to_split_on=headers_to_split_on,
                strip_headers=False,
            )
            combined_text = "\n\n".join(d.page_content for d in docs)
            md_chunks = md_splitter.split_text(combined_text)

            # Now apply character splitter on each section to respect chunk_size
            char_splitter = RecursiveCharacterTextSplitter(
                chunk_size=_CHUNK_SIZE,
                chunk_overlap=_CHUNK_OVERLAP,
                add_start_index=True,
                separators=["\n\n", "\n", ". ", " ", ""],
            )
            for chunk in md_chunks:
                section_header = " > ".join(
                    v for k, v in sorted(chunk.metadata.items()) if k.startswith("h")
                )
                sub_chunks = char_splitter.split_documents([chunk])
                for sc in sub_chunks:
                    sc.metadata["source"] = file_path
                    sc.metadata["section_header"] = section_header
                splits.extend(sub_chunks)

            if splits:
                logger.info("Markdown splitting produced %d chunks for %s", len(splits), file_path)
                return splits
        except Exception as exc:
            logger.warning("MarkdownHeaderTextSplitter failed (%s) — falling back.", exc)

    # Default: Recursive character splitter
    char_splitter = RecursiveCharacterTextSplitter(
        chunk_size=_CHUNK_SIZE,
        chunk_overlap=_CHUNK_OVERLAP,
        add_start_index=True,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    splits = char_splitter.split_documents(docs)

    # Ensure every chunk has source and section_header metadata
    for chunk in splits:
        chunk.metadata.setdefault("source", file_path)
        chunk.metadata.setdefault("section_header", "")

    return splits


def setup_vector_store(file_paths: List[str], overwrite: bool = True):
    """
    Index a list of documents into ChromaDB and the BM25 store.

    Parameters
    ----------
    file_paths : list of absolute file paths to process
    overwrite  : if True, wipe the existing ChromaDB collection first
    """
    global _retriever

    all_splits: List[Document] = []
    processor = DocumentProcessor()

    for file_path in file_paths:
        logger.info("Processing: %s", file_path)
        try:
            raw_docs = processor.process_document(file_path)
            if not raw_docs:
                logger.warning("No content extracted from %s", file_path)
                continue
            splits = _split_documents(raw_docs, file_path)
            all_splits.extend(splits)
        except Exception as exc:
            logger.error("Error processing %s: %s", file_path, exc)

    if not all_splits:
        if not overwrite and _retriever:
            return _retriever
        raise ValueError("Failed to extract any readable text from the provided files.")

    logger.info("Chunking complete — %d total chunks to index.", len(all_splits))

    # ── Knowledge Graph (spaCy NER) ───────────────────────────────────────────
    try:
        from rag.graph_store import knowledge_graph
        from rag.entity_extractor import extract as extract_entities

        for i, split in enumerate(all_splits):
            chunk_id = f"chunk_{i}"
            entities = extract_entities(split.page_content)
            knowledge_graph.add_entities_from_chunk(
                chunk_id=chunk_id,
                entities=entities,
                source=split.metadata.get("source", "unknown"),
            )
        knowledge_graph.save()
        logger.info("Knowledge graph updated.")
    except Exception as exc:
        logger.warning("Knowledge graph update failed: %s", exc)

    # ── BM25 index ────────────────────────────────────────────────────────────
    try:
        bm25_store.add_chunks(all_splits)
        logger.info("BM25 index updated.")
    except Exception as exc:
        logger.warning("BM25 update failed: %s", exc)

    # ── ChromaDB ──────────────────────────────────────────────────────────────
    embeddings = _get_embeddings()
    persist_dir = settings.PERSIST_DIR

    if overwrite and os.path.exists(persist_dir):
        try:
            shutil.rmtree(persist_dir)
            logger.info("Cleared previous ChromaDB store.")
        except Exception as exc:
            logger.warning("Could not clear ChromaDB directory: %s", exc)

    if not overwrite and os.path.exists(persist_dir):
        vectorstore = Chroma(persist_directory=persist_dir, embedding_function=embeddings)
        vectorstore.add_documents(documents=all_splits)
    else:
        vectorstore = Chroma.from_documents(
            documents=all_splits,
            embedding=embeddings,
            persist_directory=persist_dir,
        )

    _retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={"k": 40, "fetch_k": 80},
    )
    logger.info("Vector store ready — %d chunks indexed.", len(all_splits))
    return _retriever


def delete_from_stores(file_path: str) -> None:
    """
    Remove all chunks for a file from both ChromaDB and the BM25 store.
    Called when a document is deleted or unsynced.
    """
    # BM25
    try:
        bm25_store.remove_by_source(file_path)
    except Exception as exc:
        logger.warning("BM25 removal failed for %s: %s", file_path, exc)

    # ChromaDB
    try:
        if os.path.exists(settings.PERSIST_DIR):
            embeddings = _get_embeddings()
            vectorstore = Chroma(
                persist_directory=settings.PERSIST_DIR,
                embedding_function=embeddings,
            )
            vectorstore._collection.delete(where={"source": file_path})
            logger.info("Deleted ChromaDB chunks for source: %s", file_path)
    except Exception as exc:
        logger.warning("ChromaDB removal failed for %s: %s", file_path, exc)


def get_retriever() -> Optional[object]:
    global _retriever
    if _retriever is not None:
        return _retriever

    if os.path.exists(settings.PERSIST_DIR):
        try:
            embeddings = _get_embeddings()
            vectorstore = Chroma(
                persist_directory=settings.PERSIST_DIR,
                embedding_function=embeddings,
            )
            _retriever = vectorstore.as_retriever(
                search_type="mmr",
                search_kwargs={"k": 40, "fetch_k": 80},
            )
            logger.info("Vector store auto-loaded from disk.")
            return _retriever
        except Exception as exc:
            logger.error("Failed to auto-load vector store: %s", exc)

    return None
