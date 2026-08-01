"""PRISM Mind Registry - Subsystem Registry & Runtime Composition Layer."""

import logging
from typing import Any, Dict, List, Optional, Type
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class SubsystemMetadata(BaseModel):
    name: str
    version: str
    description: str
    status: str = "registered"          # registered, initializing, active, failed
    lifecycle_state: str = "dormant"    # dormant, active, terminated
    dependencies: List[str] = Field(default_factory=list)
    health: str = "unknown"             # healthy, unhealthy, unknown

class PrismSubsystem:
    """Base class for all PRISM subsystems."""
    
    def __init__(self, metadata: SubsystemMetadata):
        self.metadata = metadata

    async def initialize(self, registry: Any) -> None:
        """Initialize the subsystem. Can be overridden."""
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"
        self.metadata.status = "active"
        self.metadata.health = "healthy"

    async def check_health(self) -> str:
        """Check health of the subsystem. Can be overridden."""
        return self.metadata.health

    async def shutdown(self) -> None:
        """Shutdown the subsystem. Can be overridden."""
        self.metadata.status = "registered"
        self.metadata.lifecycle_state = "dormant"


class PlaceholderSubsystem(PrismSubsystem):
    """Subsystem placeholder for unimplemented core capabilities."""
    
    def __init__(self, name: str, description: str, dependencies: List[str] = None):
        metadata = SubsystemMetadata(
            name=name,
            version="1.0.0",
            description=description,
            dependencies=dependencies or []
        )
        super().__init__(metadata)


class MindRegistry:
    """Subsystem for composing, registering, and discovering PRISM subsystems."""

    def __init__(self):
        self._subsystems: Dict[str, PrismSubsystem] = {}
        self._lazy_loaders: Dict[str, tuple[Type[PrismSubsystem], tuple, dict]] = {}
        self.is_initialized = False

    async def initialize(self) -> None:
        """Initialize the Mind Registry."""
        logger.info("Initializing PRISM Mind Registry...")
        self.is_initialized = True
        logger.info("PRISM Mind Registry initialized.")

    def register(self, name: str, subsystem: PrismSubsystem) -> None:
        """Register a subsystem instance."""
        if name in self._subsystems:
            logger.warning(f"Subsystem '{name}' is already registered. Overwriting.")
        self._subsystems[name] = subsystem
        logger.info(f"Registered subsystem: {name} (v{subsystem.metadata.version})")

    def register_lazy(self, name: str, cls: Type[PrismSubsystem], *args, **kwargs) -> None:
        """Register a subsystem for lazy initialization."""
        self._lazy_loaders[name] = (cls, args, kwargs)
        logger.info(f"Registered lazy subsystem loader: {name}")

    async def lookup(self, name: str) -> PrismSubsystem:
        """Look up a registered subsystem. If lazy, instantiates it."""
        if name not in self._subsystems:
            if name in self._lazy_loaders:
                cls, args, kwargs = self._lazy_loaders.pop(name)
                logger.info(f"Lazy-initializing subsystem: {name}")
                subsystem = cls(*args, **kwargs)
                self.register(name, subsystem)
                await subsystem.initialize(self)
            else:
                raise KeyError(f"Subsystem '{name}' not found in Mind Registry.")
        return self._subsystems[name]

    def get_all_metadata(self) -> Dict[str, Dict[str, Any]]:
        """Query metadata for all registered subsystems."""
        metadata = {}
        for name, sub in self._subsystems.items():
            metadata[name] = sub.metadata.model_dump()
        for name, (cls, _, _) in self._lazy_loaders.items():
            metadata[name] = {
                "name": name,
                "version": "unknown",
                "description": "Lazy subsystem (not yet loaded)",
                "status": "lazy",
                "lifecycle_state": "dormant",
                "dependencies": [],
                "health": "unknown"
            }
        return metadata

    async def check_all_health(self) -> Dict[str, str]:
        """Perform health checks on all registered subsystems."""
        health_status = {}
        for name, sub in self._subsystems.items():
            try:
                health_status[name] = await sub.check_health()
            except Exception as e:
                logger.error(f"Health check failed for subsystem '{name}': {e}")
                health_status[name] = "unhealthy"
                sub.metadata.health = "unhealthy"
        for name in self._lazy_loaders.keys():
            health_status[name] = "unknown"
        return health_status


mind_registry = MindRegistry()
