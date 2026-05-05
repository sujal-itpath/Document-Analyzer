import networkx as nx
import os
import json
from typing import List, Dict
from langchain_core.documents import Document

class KnowledgeGraph:
    def __init__(self):
        self.graph = nx.Graph()
        self.persist_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "knowledge_graph.json")
        self.load()

    def add_entities_from_text(self, text: str, source: str, chunk_id: str):
        """
        Extracts entities and adds them to the graph.
        """
        import re
        # Naive entity extraction: Capitalized words (Proper Nouns)
        entities = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        entities = [e.strip() for e in entities if len(e) > 2]
        # Remove duplicates
        entities = list(set(entities))
        
        self.add_chunk_relationship(chunk_id, entities, {"source": source})
        return entities

    def add_chunk_relationship(self, chunk_id: str, entities: List[str], metadata: Dict):
        """Adds a chunk and its entities to the graph."""
        self.graph.add_node(chunk_id, type='chunk', **metadata)
        for entity in entities:
            self.graph.add_node(entity, type='entity')
            self.graph.add_edge(chunk_id, entity)

    def search_related_entities(self, entities: List[str], depth: int = 1) -> List[str]:
        """Finds related entities/chunks in the graph."""
        related = set()
        for entity in entities:
            if entity in self.graph:
                neighbors = nx.single_source_shortest_path_length(self.graph, entity, cutoff=depth)
                related.update(neighbors.keys())
        return list(related)

    def save(self):
        data = nx.node_link_data(self.graph)
        with open(self.persist_path, 'w') as f:
            json.dump(data, f)

    def load(self):
        if os.path.exists(self.persist_path):
            with open(self.persist_path, 'r') as f:
                data = json.load(f)
                self.graph = nx.node_link_graph(data)

# Global instance
knowledge_graph = KnowledgeGraph()
