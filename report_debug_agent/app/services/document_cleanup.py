import logging
import os
from typing import Optional

from rag.vector_store import delete_from_stores

logger = logging.getLogger(__name__)


def cleanup_document_artifacts(file_path: Optional[str]) -> None:
    """Remove vector/BM25 chunks and the uploaded file for a document path."""
    if not file_path:
        return

    try:
        delete_from_stores(file_path)
    except Exception as exc:
        logger.warning("Could not remove index data for %s: %s", file_path, exc)

    if not os.path.exists(file_path):
        return

    try:
        os.remove(file_path)
    except Exception as exc:
        logger.warning("Could not delete file %s: %s", file_path, exc)
