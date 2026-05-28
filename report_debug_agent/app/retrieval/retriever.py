import logging
from typing import List, Tuple
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
from app.core.config import settings
from app.db.database import SessionLocal, Document as DBDocument
from app.vectorstore.chroma_store import sanitise_collection_name

logger = logging.getLogger(__name__)

def retrieve_context(query: str, collection_name: str) -> Tuple[List[str], List[dict]]:
    """
    Retrieve document chunks from ChromaDB for a specific document filename (matched by collection_name).
    Loads Chroma directly from persist directory, queries chunks filtered by source file path,
    sorts them sequentially by page number (1-indexed) and start index, and returns page contents and metadatas.
    """
    db = SessionLocal()
    file_path = None
    try:
        documents = db.query(DBDocument).all()
        for doc in documents:
            if sanitise_collection_name(doc.filename) == collection_name:
                file_path = doc.file_path
                break
    finally:
        db.close()

    if not file_path:
        logger.warning(f"Could not map collection name '{collection_name}' to any uploaded document in database.")
        return [], []

    try:
        embeddings = OllamaEmbeddings(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_EMBED_MODEL,
        )
        vectorstore = Chroma(
            persist_directory=settings.PERSIST_DIR,
            embedding_function=embeddings,
        )
        
        # Retrieve all chunks belonging to this document source
        results = vectorstore.get(where={"source": file_path})
        
        docs = results.get("documents", [])
        metadatas = results.get("metadatas", [])
        
        if not docs:
            logger.warning(f"ChromaDB returned 0 chunks for document '{file_path}'.")
            return [], []
            
        # Pair documents and metadatas, sort them by page number, then start_index
        paired = list(zip(docs, metadatas))
        paired.sort(key=lambda x: (x[1].get("page", 0), x[1].get("start_index", 0)))
        
        sorted_docs = [p[0] for p in paired]
        sorted_metadatas = [p[1] for p in paired]
        
        logger.info(f"Successfully retrieved and sorted {len(sorted_docs)} chunk(s) from document '{file_path}'.")
        return sorted_docs, sorted_metadatas
        
    except Exception as e:
        logger.error(f"Failed to retrieve context from ChromaDB for collection '{collection_name}': {e}")
        return [], []
