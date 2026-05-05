import os
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
    # In a real implementation, we'd use the query to find entities.
    # For now, we'll search the graph for nodes matching the query or related to it.
    related_nodes = knowledge_graph.search_related_entities([query], depth=1)
    
    if not related_nodes:
        return f"No direct graph connections found for '{query}'."
        
    return f"Graph connections for '{query}': " + ", ".join(related_nodes)
