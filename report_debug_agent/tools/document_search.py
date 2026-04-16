import os
from langchain_core.tools import tool
from rag.vector_store import get_retriever

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
    retriever = get_retriever()
    if not retriever:
     return "No document has been loaded yet. Please ask the user to provide a document first."
    
    # Retrieve relevant document chunks
    docs = retriever.invoke(query)
    
    # Combine the text of the retrieved chunks
    if not docs:
        return "No relevant information found in the documents for that query."
        
    formatted_docs = []
    for doc in docs:
        source = doc.metadata.get('source', 'Unknown Source')
        formatted_docs.append(f"--- SOURCE: {os.path.basename(source)} ---\n{doc.page_content}")
        
    return "\n\n".join(formatted_docs)