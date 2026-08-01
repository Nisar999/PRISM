"""PRISM Knowledge Layer Subsystem."""

import logging
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field
from prism.core.mind_registry import PrismSubsystem, SubsystemMetadata
from prism.core.capability import Capability, CapabilityMetadata

logger = logging.getLogger(__name__)

class KnowledgeNode(BaseModel):
    id: str
    type: str  # e.g., programming_language, framework, database, ai_model, design_pattern, architecture, devops, networking, security
    name: str
    description: str
    categories: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    ontology_metadata: Dict[str, Any] = Field(default_factory=dict)

class KnowledgeEdge(BaseModel):
    source_id: str
    target_id: str
    type: str  # e.g., implements, extends, runs_on, relates_to, optimizes
    description: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class KnowledgeGraph(PrismSubsystem):
    """Subsystem responsible for structured, universal ontology and domain knowledge."""

    def __init__(self):
        super().__init__(SubsystemMetadata(
            name="knowledge_graph",
            version="1.0.0",
            description="Manages universal structured ontologies and domain knowledge.",
            dependencies=["configuration"]
        ))
        self._nodes: Dict[str, KnowledgeNode] = {}
        self._edges: List[KnowledgeEdge] = []
        self._adjacency_list: Dict[str, List[KnowledgeEdge]] = {}

    async def initialize(self, registry: Any) -> None:
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"
        
        self._load_default_ontology()

        # Register as a capability in CapabilityRegistry if available
        try:
            cap_registry = await registry.lookup("capability_registry")
            cap_registry.register(Capability(CapabilityMetadata(
                id="knowledge_graph",
                name="Knowledge Graph",
                version="1.0.0",
                description="Universal structured knowledge graph."
            )))
        except Exception as e:
            logger.warning(f"Could not register knowledge_graph capability: {e}")

        self.metadata.status = "active"
        self.metadata.health = "healthy"
        logger.info(f"Knowledge Graph initialized with {len(self._nodes)} nodes and {len(self._edges)} edges.")

    def add_node(self, node: KnowledgeNode) -> None:
        self._nodes[node.id] = node
        if node.id not in self._adjacency_list:
            self._adjacency_list[node.id] = []
        logger.debug(f"Added knowledge node: {node.id}")

    def add_edge(self, edge: KnowledgeEdge) -> None:
        if edge.source_id not in self._nodes or edge.target_id not in self._nodes:
            raise ValueError(f"Both source '{edge.source_id}' and target '{edge.target_id}' nodes must exist.")
        self._edges.append(edge)
        self._adjacency_list[edge.source_id].append(edge)
        logger.debug(f"Added knowledge edge: {edge.source_id} -[{edge.type}]-> {edge.target_id}")

    def lookup_node(self, node_id: str) -> KnowledgeNode:
        if node_id not in self._nodes:
            raise KeyError(f"Node '{node_id}' not found.")
        return self._nodes[node_id]

    def get_edges(self, node_id: str) -> List[KnowledgeEdge]:
        return self._adjacency_list.get(node_id, [])

    def traverse(self, start_id: str, relationship_type: Optional[str] = None, max_depth: int = 3) -> Set[str]:
        """Performs a breadth-first search traversal through the ontology graph."""
        if start_id not in self._nodes:
            return set()

        visited = set()
        queue = [(start_id, 0)]

        while queue:
            node_id, depth = queue.pop(0)
            if node_id not in visited and depth <= max_depth:
                visited.add(node_id)
                for edge in self._adjacency_list.get(node_id, []):
                    if relationship_type is None or edge.type == relationship_type:
                        queue.append((edge.target_id, depth + 1))
        
        return visited

    def search_by_type(self, type_name: str) -> List[KnowledgeNode]:
        return [node for node in self._nodes.values() if node.type == type_name]

    def _load_default_ontology(self) -> None:
        # Programming Languages
        self.add_node(KnowledgeNode(
            id="python", type="programming_language", name="Python",
            description="High-level, interpreted scripting language.",
            categories=["Back-end"], tags=["dynamic", "interpreted"],
            ontology_metadata={"typing": "strong, dynamic"}
        ))
        self.add_node(KnowledgeNode(
            id="typescript", type="programming_language", name="TypeScript",
            description="Strict syntactical superset of JavaScript adding optional static typing.",
            categories=["Front-end", "Back-end"], tags=["static", "typed"],
            ontology_metadata={"typing": "static, structural"}
        ))

        # Frameworks
        self.add_node(KnowledgeNode(
            id="fastapi", type="framework", name="FastAPI",
            description="Modern, fast (high-performance), web framework for building APIs with Python.",
            categories=["API", "Back-end"], tags=["async", "pydantic"]
        ))
        self.add_node(KnowledgeNode(
            id="react", type="framework", name="React",
            description="JavaScript library for building user interfaces.",
            categories=["Web", "Front-end"], tags=["components", "declarative"]
        ))

        # Databases
        self.add_node(KnowledgeNode(
            id="postgresql", type="database", name="PostgreSQL",
            description="Powerful, open-source object-relational database system.",
            categories=["Relational"], tags=["sql", "acid"]
        ))
        self.add_node(KnowledgeNode(
            id="neo4j", type="database", name="Neo4j",
            description="Native graph database management system.",
            categories=["Graph"], tags=["cypher", "nosql"]
        ))

        # AI Models
        self.add_node(KnowledgeNode(
            id="llama_3", type="ai_model", name="Llama 3",
            description="Meta's open-source large language model.",
            categories=["LLM"], tags=["transformer", "autoregressive"]
        ))

        # Design Patterns
        self.add_node(KnowledgeNode(
            id="singleton", type="design_pattern", name="Singleton",
            description="Restricts the instantiation of a class to one single instance.",
            categories=["Creational"], tags=["gof", "composition"]
        ))

        # Software Architecture
        self.add_node(KnowledgeNode(
            id="microservices", type="architecture", name="Microservices",
            description="Architectural style that structures an application as a collection of services.",
            categories=["Distributed Systems"], tags=["decoupled", "modular"]
        ))

        # DevOps
        self.add_node(KnowledgeNode(
            id="docker", type="devops", name="Docker",
            description="Platform for containerizing application dependencies.",
            categories=["Containers"], tags=["isolation", "images"]
        ))

        # Networking
        self.add_node(KnowledgeNode(
            id="http", type="networking", name="HTTP",
            description="Application-layer protocol for transmitting hypermedia documents.",
            categories=["Protocols"], tags=["stateless", "client-server"]
        ))

        # Security
        self.add_node(KnowledgeNode(
            id="jwt", type="security", name="JWT (JSON Web Tokens)",
            description="Open standard for securely transmitting information as a JSON object.",
            categories=["Authentication"], tags=["tokens", "cryptography"]
        ))

        # Add default relationships
        self.add_edge(KnowledgeEdge(
            source_id="fastapi", target_id="python", type="implements",
            description="FastAPI is written in Python."
        ))
        self.add_edge(KnowledgeEdge(
            source_id="fastapi", target_id="http", type="runs_on",
            description="FastAPI handles HTTP network traffic."
        ))
        self.add_edge(KnowledgeEdge(
            source_id="react", target_id="typescript", type="extends",
            description="React interfaces easily with TypeScript typed components."
        ))
        self.add_edge(KnowledgeEdge(
            source_id="microservices", target_id="docker", type="optimizes",
            description="Microservices deployment is optimized through Docker isolation."
        ))

knowledge_graph = KnowledgeGraph()
