import os
from langchain_core.tools import tool
from rag.vector_store import get_retriever

@tool
def compare_documents(query: str, document_names: list[str]) -> str:
    """
    Compares information across multiple specific documents based on a query.
    Use this tool when the user asks to compare, contrast, or find differences between specific documents.
    
    Args:
        query (str): The specific topic or question to compare across documents.
        document_names (list[str]): List of filenames to compare (e.g., ["report_v1.pdf", "report_v2.pdf"]).
        
    Returns:
        str: A structured comparison of information found in each document.
    """
    retriever = get_retriever()
    if not retriever:
        return "No documents have been loaded yet."
    
    results = {}
    
    # We use the vectorstore directly to filter by source if possible
    # Chroma allows filtering by metadata
    try:
        vectorstore = retriever.vectorstore
        for doc_name in document_names:
            # Search specifically for this document
            # Note: metadata 'source' usually contains the full path
            search_results = vectorstore.similarity_search(
                query, 
                k=3, 
                filter={"source": {"$contains": doc_name}} 
            )
            
            if not search_results:
                # Fallback: search everything and filter manually if $contains isn't supported or fails
                all_results = vectorstore.similarity_search(query, k=20)
                search_results = [d for d in all_results if doc_name in d.metadata.get('source', '')][:3]
            
            results[doc_name] = "\n".join([d.page_content for d in search_results]) if search_results else "No relevant information found."
            
    except Exception as e:
        return f"Error during comparison: {str(e)}"
    
    formatted_output = "### Comparison Results\n\n"
    for doc_name, content in results.items():
        formatted_output += f"#### Document: {doc_name}\n{content}\n\n"
        
    return formatted_output
