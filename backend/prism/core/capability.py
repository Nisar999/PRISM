"""PRISM Capability Registry Subsystem."""

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from prism.core.mind_registry import PrismSubsystem, SubsystemMetadata

logger = logging.getLogger(__name__)

class CapabilityMetadata(BaseModel):
    id: str
    name: str
    version: str
    description: str
    dependencies: List[str] = Field(default_factory=list)
    required_providers: List[str] = Field(default_factory=list)
    required_tools: List[str] = Field(default_factory=list)
    required_models: List[str] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list)
    health: str = "healthy"
    status: str = "enabled"  # enabled, disabled

class Capability:
    """Represents a PRISM runtime capability."""
    def __init__(self, metadata: CapabilityMetadata):
        self.metadata = metadata

    async def enable(self) -> None:
        self.metadata.status = "enabled"

    async def disable(self) -> None:
        self.metadata.status = "disabled"


class CapabilityRegistry(PrismSubsystem):
    """Subsystem for registering, discovering, and managing capabilities."""

    def __init__(self):
        super().__init__(SubsystemMetadata(
            name="capability_registry",
            version="1.0.0",
            description="Manages discoverable runtime capabilities and permissions",
            dependencies=["configuration"]
        ))
        self._capabilities: Dict[str, Capability] = {}

    async def initialize(self, registry: Any) -> None:
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"
        
        # Register default capabilities
        self._register_default_capabilities()
        
        self.metadata.status = "active"
        self.metadata.health = "healthy"
        logger.info(f"Capability Registry initialized with {len(self._capabilities)} capabilities.")

    def register(self, capability: Capability) -> None:
        cap_id = capability.metadata.id
        self._capabilities[cap_id] = capability
        logger.info(f"Registered capability: {cap_id}")

    def lookup(self, cap_id: str) -> Capability:
        if cap_id not in self._capabilities:
            raise KeyError(f"Capability '{cap_id}' not found.")
        return self._capabilities[cap_id]

    def get_capabilities(self) -> Dict[str, Dict[str, Any]]:
        return {
            cap_id: cap.metadata.model_dump()
            for cap_id, cap in self._capabilities.items()
        }

    def _register_default_capabilities(self) -> None:
        # Existing systems
        self.register(Capability(CapabilityMetadata(
            id="memory", name="Memory Engine", version="1.0.0",
            description="Core memory classification, scoring, storage, and retrieval.",
            required_providers=["litellm"]
        )))
        self.register(Capability(CapabilityMetadata(
            id="reflection", name="Reflection Engine", version="1.0.0",
            description="Audit execution for contradictions and hallucinations."
        )))
        self.register(Capability(CapabilityMetadata(
            id="healing", name="Healing Engine", version="1.0.0",
            description="Self-healing of conflicting or corrupted memories."
        )))
        self.register(Capability(CapabilityMetadata(
            id="agent_runtime", name="Agent Runtime", version="1.0.0",
            description="LangGraph orchestrator for agent states."
        )))
        self.register(Capability(CapabilityMetadata(
            id="provider_layer", name="Provider Layer", version="1.0.0",
            description="Pluggable model endpoint abstraction."
        )))
        
        # Placeholders
        placeholders = [
            ("planning", "Planning", "Deconstructs high-level user tasks."),
            ("trust", "Trust", "Computes and evaluates trust scores."),
            ("workspace", "Workspace", "Adapts IDEs and UI adapters."),
            ("timeline", "Timeline", "Visualizes temporal changes."),
            ("globe_view", "Globe View", "Visualizes memory relationships."),
            ("thought_view", "Thought View", "Visualizes thought trace graphs."),
            ("memory_prism", "Memory Prism", "Visualizes memory strata layers."),
            ("resource_manager", "Resource Manager", "Observes local CPU/GPU/NPU usage."),
            ("model_router", "Model Router", "Routes request dynamically to backends."),
            ("tool_orchestrator", "Tool Orchestrator", "Selects tools and produces ToolExecutionPlans for ExecutionTasks."),
            ("execution_runtime", "Execution Runtime", "Manages execution lifecycle: sessions, state transitions, retry, pause/resume, cancellation, events, progress, and artifacts."),
            ("visualization", "Visualization", "Cognitive rendering helper.")
        ]
        for cid, name, desc in placeholders:
            self.register(Capability(CapabilityMetadata(
                id=cid, name=name, version="1.0.0", description=desc
            )))

capability_registry = CapabilityRegistry()
