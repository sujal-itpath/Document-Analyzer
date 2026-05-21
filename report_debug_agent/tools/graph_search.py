from langchain_core.tools import tool
from rag.graph_store import knowledge_graph

@tool
def graph_search(query: str) -> str:
    """
    Search for related entities and conceptual links in the knowledge graph.
    Use this to find connected information that might not be directly in the text but is related.
    
    Args:
        query (str): The entity or concept to look up in the graph.
        
    Returns:
        str: A summary of related concepts and connections.
    """
    related_nodes = knowledge_graph.search_related_entities([query], depth=2)
    
    if not related_nodes:
        return f"No direct graph connections found for '{query}'."
        
    return f"Graph connections for '{query}': " + ", ".join(related_nodes[:15])
