"""
Knowledge Graph backed by NetworkX — upgraded to use spaCy NER typed entities
and directed edges with relationship labels.

Node types:
  - "chunk"  : a document chunk (id = chunk_0, chunk_1, …)
  - "entity" : a named entity with a "label" attribute (ORG, PERSON, DATE, …)

Edge types:
  - chunk → entity : "mentions" (undirected semantic; stored as directed)
  - entity → entity: future extensibility for cross-entity relationships
"""

import json
import logging
import os
from typing import Dict, List, Optional

import networkx as nx

logger = logging.getLogger(__name__)


class KnowledgeGraph:
    def __init__(self):
        self.graph = nx.DiGraph()  # Directed graph for richer relationships
        self.persist_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "knowledge_graph.json",
        )
        self.load()

    # ── Ingestion ─────────────────────────────────────────────────────────────

    def add_entities_from_chunk(
        self,
        chunk_id: str,
        entities: List[Dict[str, str]],
        source: str,
    ) -> None:
        """
        Add a document chunk and its spaCy-extracted entities to the graph.

        Parameters
        ----------
        chunk_id : unique string id for the chunk
        entities : list of {"entity": str, "label": str} dicts from entity_extractor
        source   : absolute file path of the source document
        """
        self.graph.add_node(chunk_id, type="chunk", source=source)

        for ent in entities:
            entity_name = ent.get("entity", "").strip()
            entity_label = ent.get("label", "MISC")
            if not entity_name:
                continue

            # Add or update entity node
            if entity_name not in self.graph:
                self.graph.add_node(entity_name, type="entity", label=entity_label)
            else:
                # Update label if previously MISC
                if self.graph.nodes[entity_name].get("label") == "MISC":
                    self.graph.nodes[entity_name]["label"] = entity_label

            # Directed edge: chunk mentions entity
            self.graph.add_edge(chunk_id, entity_name, relation="mentions")

    def add_relationship(
        self,
        source_entity: str,
        target_entity: str,
        relation: str,
        source_doc: Optional[str] = None,
    ) -> None:
        """Add a directed relationship between two entities."""
        for node in (source_entity, target_entity):
            if node not in self.graph:
                self.graph.add_node(node, type="entity", label="MISC")
        self.graph.add_edge(
            source_entity,
            target_entity,
            relation=relation,
            source_doc=source_doc or "",
        )

    # ── Legacy shim — keeps old callers working ───────────────────────────────

    def add_entities_from_text(self, text: str, source: str, chunk_id: str) -> List[str]:
        """
        Backward-compatible wrapper. Calls the spaCy extractor internally.
        Returns a flat list of entity strings for logging.
        """
        try:
            from rag.entity_extractor import extract
            entities = extract(text)
        except Exception:
            entities = []
        self.add_entities_from_chunk(chunk_id, entities, source)
        return [e["entity"] for e in entities]

    # ── Search ────────────────────────────────────────────────────────────────

    def search_related_entities(self, entities: List[str], depth: int = 2) -> List[str]:
        """Find all nodes within `depth` hops of any of the given entities."""
        related: set = set()
        for entity in entities:
            if entity in self.graph:
                neighbors = nx.single_source_shortest_path_length(
                    self.graph.to_undirected(), entity, cutoff=depth
                )
                related.update(neighbors.keys())
        return list(related)

    def search_with_context(
        self,
        entities: List[str],
        depth: int = 2,
    ) -> List[Dict]:
        """
        Rich search: returns structured context dicts with entity type and
        how each related node is connected to the query entities.

        Returns list of: {"node": str, "type": str, "label": str, "relation": str}
        """
        results = []
        seen = set()

        for entity in entities:
            if entity not in self.graph:
                continue

            # BFS up to `depth` hops on the undirected view
            undirected = self.graph.to_undirected()
            paths = nx.single_source_shortest_path(undirected, entity, cutoff=depth)

            for neighbor, path in paths.items():
                if neighbor in seen or neighbor == entity:
                    continue
                seen.add(neighbor)

                node_data = self.graph.nodes.get(neighbor, {})
                node_type = node_data.get("type", "unknown")

                # Get the edge relation between consecutive nodes in the path
                relation = "related"
                if len(path) >= 2:
                    u, v = path[-2], path[-1]
                    edge_data = self.graph.edges.get((u, v), self.graph.edges.get((v, u), {}))
                    relation = edge_data.get("relation", "related")

                results.append({
                    "node": neighbor,
                    "type": node_type,
                    "label": node_data.get("label", ""),
                    "relation": relation,
                    "hops": len(path) - 1,
                })

        # Sort: entities first (type="entity"), then chunks, then by hops
        results.sort(key=lambda x: (x["type"] != "entity", x["hops"]))
        return results[:30]  # cap for readability

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self) -> None:
        try:
            data = nx.node_link_data(self.graph)
            with open(self.persist_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
        except Exception as exc:
            logger.warning("Knowledge graph save failed: %s", exc)

    def load(self) -> None:
        if os.path.exists(self.persist_path):
            try:
                with open(self.persist_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.graph = nx.node_link_graph(data)
                logger.info(
                    "Knowledge graph loaded: %d nodes, %d edges.",
                    self.graph.number_of_nodes(),
                    self.graph.number_of_edges(),
                )
            except Exception as exc:
                logger.warning("Knowledge graph load failed: %s", exc)
                self.graph = nx.DiGraph()


# Global singleton instance
knowledge_graph = KnowledgeGraph()
