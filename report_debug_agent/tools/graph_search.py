"""
graph_search tool — queries the Knowledge Graph using spaCy-extracted entities.

Upgraded from regex-based lookup to:
1. Extract named entities from the query using spaCy NER.
2. Search the graph for those entities and their 2-hop neighbors.
3. Return a structured, readable summary with entity types and relationships.
"""

import logging
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


@tool
def graph_search(query: str) -> str:
    """
    Search for named entities and their relationships in the knowledge graph.

    Use this as SUPPORTING context alongside search_document — not as the
    primary evidence source. Good for questions like:
    - "What organizations are mentioned in this document?"
    - "Are there any dates or deadlines in this report?"
    - "What people are referenced in this contract?"

    Args:
        query: A natural language question or entity name to look up.

    Returns:
        A structured summary of related entities and their connections.
    """
    from rag.graph_store import knowledge_graph
    from rag.entity_extractor import extract_from_query

    # Extract meaningful entities from the query
    entities = extract_from_query(query)

    if not entities:
        # Fallback: use the raw query as a single entity lookup
        entities = [query.strip()]

    # Search graph with full context
    related = knowledge_graph.search_with_context(entities, depth=2)

    if not related:
        return (
            f"No graph connections found for entities extracted from: '{query}'.\n"
            f"Searched for: {', '.join(entities[:5])}"
        )

    # Build readable output grouped by entity type
    entity_nodes = [r for r in related if r["type"] == "entity"]
    chunk_nodes = [r for r in related if r["type"] == "chunk"]

    lines = [f"**Graph results for:** {', '.join(entities[:5])}\n"]

    if entity_nodes:
        lines.append("**Named Entities Found:**")
        for node in entity_nodes[:15]:
            label = f" ({node['label']})" if node["label"] else ""
            lines.append(f"  • {node['node']}{label} — {node['relation']} ({node['hops']} hop)")

    if chunk_nodes:
        lines.append(f"\n**Related document sections:** {len(chunk_nodes)} chunk(s) connected.")

    return "\n".join(lines)
