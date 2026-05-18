import os
from langchain_core.tools import tool
from app.services.retrieval import search_docs

@tool
def search_document(query: str) -> str:
    """
    Search the loaded document for information to answer user questions.
    Always use this tool when the user asks a question about the document context.
    
    Args:
        query (str): The search query to look up in the document.
        
    Returns:
        str: Relevant text snippets from the document.
    """
    docs = search_docs(query, k=20)
    if not docs:
        return "No relevant information found in the selected documents for that query."
        
    formatted_docs = []
    for doc in docs:
        source = doc.metadata.get('source', 'Unknown Source')
        formatted_docs.append(f"--- SOURCE: {os.path.basename(source)} ---\n{doc.page_content}")
        
    return "\n\n".join(formatted_docs)
