from typing import Dict, List, Tuple

from app.retrieval.retriever import retrieve_context
from app.llm.test_case_chain import generate_test_case_output


# ---------------------------------------------------------------------------
# Broad query — used for full-document context retrieval
# ---------------------------------------------------------------------------

# Unlike Q&A (which uses the user's specific question as the search query),
# test case generation needs content from EVERY part of the document.
# This broad query contains keywords that semantically match requirements,
# modules, forms, and rules across the entire document — so ChromaDB
# returns chunks from all sections, not just one topic.
_BROAD_QUERY = (
    "all features modules screens pages forms input fields "
    "buttons actions validations business rules workflows "
    "user roles permissions conditions requirements functionalities"
)


# ---------------------------------------------------------------------------
# Main pipeline function
# ---------------------------------------------------------------------------

def generate_test_cases(
    collection_name: str,
    test_type: str | None,
) -> Tuple[Dict[str, list], List[int]]:
    """
    End-to-end pipeline to generate BDD test cases from an indexed document.

    Flow:
        1. Build a broad, keyword-rich query (automatic — no user input needed).
        2. Retrieve all relevant chunks from ChromaDB using semantic search.
        3. Pass chunks + test_type to the LLM chain (Gemini).
        4. Return the parsed test cases dict and page citations.

    Why a broad query?
        - Q&A retrieval uses the user's specific question to find ONE answer.
        - Test case generation must cover EVERY module and feature in the document.
        - A broad query ensures semantic search returns chunks from all sections.

    Args:
        collection_name : ChromaDB collection name (= sanitised document filename).
        test_type       : Type of test cases to generate.
                          Nullable — defaults to "Manual" inside the chain.
                          Supported: "Manual" | "API" | "Smoke" | "Regression" | "All"

    Returns:
        Tuple of:
          - Dict[str, list] : Test cases grouped by module name.
                              e.g. { "Login": [...], "Dashboard": [...] }
          - List[int]       : Unique page numbers cited as sources.

    Raises:
        ValueError : If no content is found in ChromaDB for the collection,
                     or if the LLM returns invalid / unparseable JSON.
    """
    # ------------------------------------------------------------------
    # Step 1: Retrieve document chunks using the broad query
    # The retriever embeds this query and performs semantic search in ChromaDB,
    # then expands results with neighbour pages for better coverage.
    # ------------------------------------------------------------------
    documents, metadatas = retrieve_context(_BROAD_QUERY, collection_name)

    # ------------------------------------------------------------------
    # Step 2: Guard — if no content found, raise a clear error
    # This can happen if the document is empty or failed to index properly.
    # ------------------------------------------------------------------
    if not documents:
        raise ValueError(
            "No content could be retrieved from the document. "
            "Please ensure the document was uploaded and indexed successfully."
        )

    # ------------------------------------------------------------------
    # Step 3: Pass retrieved chunks to the LLM chain
    # The chain builds the BDD prompt, calls Gemini, and parses the JSON response.
    # ------------------------------------------------------------------
    test_cases_dict, citations = generate_test_case_output(
        documents=documents,
        metadatas=metadatas,
        test_type=test_type,
    )

    return test_cases_dict, citations
