from typing import Dict, List, Tuple

from rag.vector_store import get_retriever
from app.llm.test_case_chain import generate_test_case_output

# Broad query \u2014 used for full-document context retrieval
_BROAD_QUERY = (
    "all features modules screens pages forms input fields "
    "buttons actions validations business rules workflows "
    "user roles permissions conditions requirements functionalities"
)

def retrieve_context(query: str, collection_name: str) -> Tuple[List[str], List[Dict]]:
    """Retrieve all chunks from the document in the vector store."""
    retriever = get_retriever()
    if not retriever:
        return [], []
    
    # In a real implementation we would filter by collection_name/filename
    # For now we just query the retriever directly
    docs = retriever.invoke(query)
    
    # If the collection_name matches filename, we can filter
    # Assuming collection_name is derived from filename
    # But since it's just a demo, we will just return all fetched docs
    return [d.page_content for d in docs], [d.metadata for d in docs]

def generate_test_cases(
    collection_name: str,
    test_type: str | None,
) -> Tuple[Dict[str, list], List[int]]:
    """
    End-to-end pipeline to generate BDD test cases from an indexed document.
    """
    documents, metadatas = retrieve_context(_BROAD_QUERY, collection_name)

    if not documents:
        raise ValueError(
            "No content could be retrieved from the document. "
            "Please ensure the document was uploaded and indexed successfully."
        )

    test_cases_dict, citations = generate_test_case_output(
        documents=documents,
        metadatas=metadatas,
        test_type=test_type,
    )

    return test_cases_dict, citations
