"""PRISM Context Engine Subsystem."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from prism.core.mind_registry import PrismSubsystem, SubsystemMetadata
from prism.core.capability import Capability, CapabilityMetadata

logger = logging.getLogger(__name__)


class WorkspaceContext(BaseModel):
    workspace_root: Optional[str] = None
    active_project: Optional[str] = None
    active_files: List[str] = Field(default_factory=list)
    git_branch: Optional[str] = None
    git_commit: Optional[str] = None
    git_dirty: bool = False
    docker_compose_file: Optional[str] = None
    docker_running_services: List[str] = Field(default_factory=list)


class RuntimeContext(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    active_providers: List[str] = Field(default_factory=list)
    active_models: List[str] = Field(default_factory=list)
    active_capabilities: List[str] = Field(default_factory=list)
    active_tools: List[str] = Field(default_factory=list)
    health: str = "healthy"  # healthy, degraded, unhealthy
    resource_snapshot: Dict[str, Any] = Field(default_factory=dict)


class Context(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    workspace: WorkspaceContext = Field(default_factory=WorkspaceContext)
    runtime: RuntimeContext = Field(default_factory=RuntimeContext)
    current_plan_id: Optional[str] = None
    current_stage_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def snapshot(self) -> "Context":
        """Return a deep snapshot of the current context."""
        return self.model_copy(deep=True)

    def merge(self, patch: Dict[str, Any]) -> None:
        """Apply incremental updates from a flat key-value patch."""
        for key, value in patch.items():
            if hasattr(self, key):
                setattr(self, key, value)
            elif hasattr(self.workspace, key):
                setattr(self.workspace, key, value)
            elif hasattr(self.runtime, key):
                setattr(self.runtime, key, value)
            else:
                self.metadata[key] = value
        self.timestamp = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump(mode="json")

    def query(self, field: str) -> Any:
        """Query a top-level, workspace, or runtime field by name."""
        if hasattr(self, field):
            return getattr(self, field)
        if hasattr(self.workspace, field):
            return getattr(self.workspace, field)
        if hasattr(self.runtime, field):
            return getattr(self.runtime, field)
        return self.metadata.get(field)


class ContextEngine(PrismSubsystem):
    """Subsystem responsible for managing the current PRISM runtime context."""

    def __init__(self):
        super().__init__(SubsystemMetadata(
            name="context_engine",
            version="1.0.0",
            description="Manages the current runtime state: workspace, session, tools, providers, and execution.",
            dependencies=["configuration"]
        ))
        self._context: Context = Context()
        self._snapshots: List[Context] = []

    async def initialize(self, registry: Any) -> None:
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"

        # Hydrate the context from the live registry state
        await self._hydrate(registry)

        try:
            cap_registry = await registry.lookup("capability_registry")
            cap_registry.register(Capability(CapabilityMetadata(
                id="context_engine",
                name="Context Engine",
                version="1.0.0",
                description="Manages live runtime state of the PRISM platform."
            )))
        except Exception as e:
            logger.warning(f"Could not register context_engine capability: {e}")

        self.metadata.status = "active"
        self.metadata.health = "healthy"
        logger.info("Context Engine initialized.")

    # ──────────────────────── Public API ────────────────────────

    @property
    def context(self) -> Context:
        return self._context

    def update(self, patch: Dict[str, Any]) -> None:
        """Apply incremental updates to the live context."""
        self._context.merge(patch)
        logger.debug(f"Context updated: {list(patch.keys())}")

    def take_snapshot(self) -> Context:
        """Save and return a deep copy of the current context."""
        snap = self._context.snapshot()
        self._snapshots.append(snap)
        logger.debug(f"Context snapshot taken: {snap.id}")
        return snap

    def get_snapshots(self) -> List[Context]:
        return list(self._snapshots)

    def query(self, field: str) -> Any:
        return self._context.query(field)

    def attach_plan(self, plan_id: str, stage_id: Optional[str] = None) -> None:
        """Set the currently active execution plan and optional stage."""
        self._context.current_plan_id = plan_id
        self._context.current_stage_id = stage_id
        self._context.timestamp = datetime.now(timezone.utc)
        logger.info(f"Context attached plan={plan_id}, stage={stage_id}")

    def set_workspace(self, root: str, project: Optional[str] = None) -> None:
        """Set the active workspace root."""
        self._context.workspace.workspace_root = root
        if project:
            self._context.workspace.active_project = project
        self._context.timestamp = datetime.now(timezone.utc)

    def serialize(self) -> Dict[str, Any]:
        """Serialize the current context to a plain dictionary."""
        return self._context.to_dict()

    # ──────────────────────── Private ────────────────────────

    async def _hydrate(self, registry: Any) -> None:
        """Populate the runtime context from live subsystem states."""
        try:
            cap_reg = await registry.lookup("capability_registry")
            enabled_caps = [
                cap_id for cap_id, cap in cap_reg.get_capabilities().items()
                if cap.get("status") == "enabled"
            ]
            self._context.runtime.active_capabilities = enabled_caps
        except Exception:
            pass

        try:
            provider_sub = await registry.lookup("provider_layer")
            if hasattr(provider_sub, "provider") and provider_sub.provider:
                self._context.runtime.active_providers = ["litellm"]
                model_name = getattr(provider_sub.provider, "default_model", None)
                if model_name:
                    self._context.runtime.active_models = [model_name]
        except Exception:
            pass

        try:
            import psutil
            self._context.runtime.resource_snapshot = {
                "cpu_percent": psutil.cpu_percent(interval=None),
                "memory_percent": psutil.virtual_memory().percent,
            }
        except ImportError:
            self._context.runtime.resource_snapshot = {"cpu_percent": None, "memory_percent": None}
        except Exception:
            pass

        # Git metadata via subprocess
        try:
            import subprocess
            branch = subprocess.check_output(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                stderr=subprocess.DEVNULL
            ).decode().strip()
            commit = subprocess.check_output(
                ["git", "rev-parse", "--short", "HEAD"],
                stderr=subprocess.DEVNULL
            ).decode().strip()
            dirty_check = subprocess.run(
                ["git", "status", "--porcelain"],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL
            )
            self._context.workspace.git_branch = branch
            self._context.workspace.git_commit = commit
            self._context.workspace.git_dirty = bool(dirty_check.stdout.strip())
        except Exception:
            pass

        self._context.timestamp = datetime.now(timezone.utc)


context_engine = ContextEngine()
