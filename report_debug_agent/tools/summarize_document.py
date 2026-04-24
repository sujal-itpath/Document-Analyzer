import os
from langchain_core.tools import tool
from rag.vector_store import get_retriever

@tool
def summarize_document(query: str = "Provide a summary of the document") -> str:
    """
    Provides a broad summary or overview of the loaded document.
    Use this tool when the user asks for a summary, an overview, or what the document is about.
    
    Args:
        query (str): A brief description of what to summarize, or "Provide a summary of the document" for a general overview.
    """
    retriever = get_retriever()
    if not retriever:
        return "No document has been loaded yet. Please ask the user to provide a document first."
    
    try:
        vectorstore = retriever.vectorstore
        docs = vectorstore.similarity_search(query, k=5)
    except AttributeError:
        docs = retriever.invoke(query)
        
    if not docs:
        return "No document chunks to summarize."
        
    formatted_docs = []
    for doc in docs:
        source = doc.metadata.get('source', 'Unknown Source')
        formatted_docs.append(f"--- SOURCE: {os.path.basename(source)} ---\n{doc.page_content}")

    return "\n\n".join(formatted_docs)