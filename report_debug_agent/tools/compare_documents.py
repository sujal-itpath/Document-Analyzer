import os
from langchain_core.tools import tool
from rag.vector_store import get_retriever
from app.services.chat_context import get_allowed_sources

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
    
    try:
        vectorstore = retriever.vectorstore
        allowed_sources = get_allowed_sources() or set()
        
        for doc_name in document_names:
            # Find the actual source path that matches this doc_name
            actual_source_path = None
            for source_path in allowed_sources:
                if os.path.basename(source_path) == doc_name or source_path == doc_name:
                    actual_source_path = source_path
                    break
            
            if not actual_source_path and allowed_sources:
                results[doc_name] = f"The document '{doc_name}' is not attached to this chat session or not recognized."
                continue
            
            # If we have a specific path, use it for filtering
            search_filter = {"source": actual_source_path} if actual_source_path else None
            
            try:
                search_results = vectorstore.similarity_search(
                    query, 
                    k=6, # Increased from 3 for better context
                    filter=search_filter
                )
            except Exception as e:
                print(f"Similarity search failed for {doc_name}: {e}")
                search_results = []
            
            if not search_results:
                # Fallback: search everything and filter manually
                all_results = vectorstore.similarity_search(query, k=30)
                search_results = [
                    d for d in all_results 
                    if (actual_source_path and d.metadata.get('source') == actual_source_path) or 
                       (not actual_source_path and doc_name in os.path.basename(d.metadata.get('source', '')))
                ][:6]
            
            results[doc_name] = "\n".join([d.page_content for d in search_results]) if search_results else "No relevant information found."
            
    except Exception as e:
        return f"Error during comparison: {str(e)}"
    
    formatted_output = "### Comparison Results\n\n"
    for doc_name, content in results.items():
        formatted_output += f"#### Document: {doc_name}\n{content}\n\n"
        
    return formatted_output