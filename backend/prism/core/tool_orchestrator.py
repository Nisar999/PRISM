"""PRISM Tool Orchestrator Subsystem.

Determines which tools are required to execute each ExecutionTask after routing
decisions have been made.  It does NOT execute tools.  It prepares and returns
ToolExecutionPlans.

Pipeline position:
    Planner -> Router -> Tool Orchestrator -> ToolExecutionPlan
"""

from __future__ import annotations

import logging
import uuid
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from prism.core.capability import Capability, CapabilityMetadata
from prism.core.mind_registry import PrismSubsystem, SubsystemMetadata

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class ToolCategory(str, Enum):
    """Canonical tool categories supported by the Tool Orchestrator."""

    FILESYSTEM = "filesystem"
    TERMINAL = "terminal"
    GIT = "git"
    DOCKER = "docker"
    PYTHON = "python"
    BROWSER = "browser"
    HTTP = "http"
    DATABASE = "database"
    VECTOR_STORE = "vector_store"
    MCP = "mcp"
    LOCAL_SCRIPT = "local_script"


class ToolExecutionMode(str, Enum):
    """How a tool is intended to be invoked relative to other tools."""

    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    CONDITIONAL = "conditional"


class ToolPriority(str, Enum):
    """Relative importance of a tool within a plan."""

    CRITICAL = "critical"   # plan fails without it
    HIGH = "high"           # strongly recommended
    MEDIUM = "medium"       # beneficial but skippable
    LOW = "low"             # optional enhancement


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------


class ToolProfile(BaseModel):
    """Describes a single tool that the orchestrator knows about."""

    id: str
    name: str
    category: ToolCategory
    description: str
    required_permissions: List[str] = Field(default_factory=list)
    # Capability IDs that indicate this tool may be needed
    trigger_capabilities: List[str] = Field(default_factory=list)
    # Skill IDs that indicate this tool may be needed
    trigger_skills: List[str] = Field(default_factory=list)
    # Free-form keywords that appear in task names/descriptions
    trigger_keywords: List[str] = Field(default_factory=list)
    # Estimated seconds to complete one invocation under normal conditions
    estimated_duration_seconds: int = 5
    is_read_only: bool = False
    supports_dry_run: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ToolRequirement(BaseModel):
    """A specific tool needed for a task, with context on why and how."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tool_id: str
    tool_name: str
    category: ToolCategory
    priority: ToolPriority = ToolPriority.MEDIUM
    execution_mode: ToolExecutionMode = ToolExecutionMode.SEQUENTIAL
    # IDs of other ToolRequirements this one depends on (within the same plan)
    depends_on: List[str] = Field(default_factory=list)
    rationale: str = ""
    config_hints: Dict[str, Any] = Field(default_factory=dict)
    # Whether this tool is only run when preceding tools succeed
    conditional_on_success: bool = False
    estimated_duration_seconds: int = 5


class ToolExecutionPlan(BaseModel):
    """
    A fully resolved plan describing every tool required to execute one
    ExecutionTask.  No tool is actually invoked; this is planning only.
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    task_name: str
    routing_decision_id: Optional[str] = None

    # Ordered list of required tools (critical path)
    required_tools: List[ToolRequirement] = Field(default_factory=list)
    # Tools that improve quality but are not mandatory
    optional_tools: List[ToolRequirement] = Field(default_factory=list)
    # Tools run after primary work to validate outputs
    validation_tools: List[ToolRequirement] = Field(default_factory=list)

    # Execution order groups: each inner list contains tool requirement IDs
    # that may run in parallel within that group.
    execution_order: List[List[str]] = Field(default_factory=list)

    # Directed graph: key = requirement_id, value = list of requirement IDs it
    # must run before (i.e. its dependents).
    dependency_graph: Dict[str, List[str]] = Field(default_factory=dict)

    # Total wall-clock estimate (seconds) assuming sequential execution.
    estimated_runtime_seconds: int = 0

    # Total wall-clock estimate (seconds) with maximum parallelism.
    estimated_parallel_runtime_seconds: int = 0

    metadata: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Built-in Tool Catalogue
# ---------------------------------------------------------------------------

_BUILTIN_PROFILES: List[ToolProfile] = [
    # -- Filesystem ----------------------------------------------------------
    ToolProfile(
        id="fs_read",
        name="Filesystem Read",
        category=ToolCategory.FILESYSTEM,
        description="Read files and directory trees from the workspace.",
        trigger_capabilities=["workspace", "context_engine"],
        trigger_skills=["backend-engineer", "frontend-engineer"],
        trigger_keywords=["read", "inspect", "view", "file", "directory", "scan"],
        estimated_duration_seconds=2,
        is_read_only=True,
    ),
    ToolProfile(
        id="fs_write",
        name="Filesystem Write",
        category=ToolCategory.FILESYSTEM,
        description="Create, modify, or delete files in the workspace.",
        required_permissions=["write"],
        trigger_capabilities=["workspace"],
        trigger_skills=["backend-engineer", "frontend-engineer", "devops"],
        trigger_keywords=["write", "create", "generate", "scaffold", "modify", "delete", "edit"],
        estimated_duration_seconds=3,
    ),
    # -- Terminal ------------------------------------------------------------
    ToolProfile(
        id="terminal_exec",
        name="Terminal Execute",
        category=ToolCategory.TERMINAL,
        description="Execute shell commands in the workspace environment.",
        required_permissions=["execute"],
        trigger_capabilities=["agent_runtime"],
        trigger_skills=["devops", "backend-engineer", "qa-test-automation"],
        trigger_keywords=["run", "execute", "command", "shell", "build", "install", "compile", "lint"],
        estimated_duration_seconds=10,
    ),
    # -- Git -----------------------------------------------------------------
    ToolProfile(
        id="git_read",
        name="Git Read",
        category=ToolCategory.GIT,
        description="Query git history, status, diff, and branch information.",
        trigger_capabilities=["context_engine"],
        trigger_skills=["devops", "backend-engineer"],
        trigger_keywords=["git", "commit", "branch", "diff", "log", "blame", "status"],
        estimated_duration_seconds=2,
        is_read_only=True,
    ),
    ToolProfile(
        id="git_write",
        name="Git Write",
        category=ToolCategory.GIT,
        description="Stage, commit, push, or rebase git changes.",
        required_permissions=["write"],
        trigger_capabilities=["workspace"],
        trigger_skills=["devops"],
        trigger_keywords=["commit", "push", "merge", "rebase", "stage", "tag"],
        estimated_duration_seconds=5,
    ),
    # -- Docker --------------------------------------------------------------
    ToolProfile(
        id="docker_inspect",
        name="Docker Inspect",
        category=ToolCategory.DOCKER,
        description="Inspect running containers, images, volumes, and networks.",
        trigger_capabilities=["resource_manager"],
        trigger_skills=["devops", "cloud-architecture"],
        trigger_keywords=["docker", "container", "image", "compose", "service", "inspect"],
        estimated_duration_seconds=3,
        is_read_only=True,
    ),
    ToolProfile(
        id="docker_exec",
        name="Docker Execute",
        category=ToolCategory.DOCKER,
        description="Build images, start/stop containers, and run docker-compose operations.",
        required_permissions=["execute"],
        trigger_capabilities=["agent_runtime"],
        trigger_skills=["devops", "cloud-architecture"],
        trigger_keywords=["docker build", "docker run", "compose up", "compose down", "deploy"],
        estimated_duration_seconds=30,
    ),
    # -- Python --------------------------------------------------------------
    ToolProfile(
        id="python_exec",
        name="Python Execute",
        category=ToolCategory.PYTHON,
        description="Run Python scripts or evaluate Python expressions in a sandbox.",
        required_permissions=["execute"],
        trigger_capabilities=["agent_runtime"],
        trigger_skills=["backend-engineer", "data-science-ai", "data-engineering"],
        trigger_keywords=["python", "script", "pytest", "test", "migration", "alembic"],
        estimated_duration_seconds=10,
    ),
    ToolProfile(
        id="python_lint",
        name="Python Lint / Format",
        category=ToolCategory.PYTHON,
        description="Run ruff, mypy, black, or isort on Python source files.",
        trigger_skills=["backend-engineer", "qa-test-automation"],
        trigger_keywords=["lint", "format", "type check", "ruff", "mypy", "black"],
        estimated_duration_seconds=5,
        is_read_only=True,
        supports_dry_run=True,
    ),
    # -- Browser -------------------------------------------------------------
    ToolProfile(
        id="browser_navigate",
        name="Browser Navigate",
        category=ToolCategory.BROWSER,
        description="Navigate to URLs and extract rendered page content.",
        trigger_capabilities=["workspace"],
        trigger_skills=["frontend-engineer", "qa-test-automation"],
        trigger_keywords=["browser", "navigate", "url", "webpage", "scrape", "e2e"],
        estimated_duration_seconds=8,
    ),
    ToolProfile(
        id="browser_interact",
        name="Browser Interact",
        category=ToolCategory.BROWSER,
        description="Click, type, and interact with web page elements.",
        trigger_skills=["frontend-engineer", "qa-test-automation"],
        trigger_keywords=["click", "fill", "form", "playwright", "selenium", "interact"],
        estimated_duration_seconds=15,
    ),
    # -- HTTP ----------------------------------------------------------------
    ToolProfile(
        id="http_request",
        name="HTTP Request",
        category=ToolCategory.HTTP,
        description="Make HTTP requests to internal or external APIs.",
        trigger_capabilities=["provider_layer"],
        trigger_skills=["backend-engineer", "api-design"],
        trigger_keywords=["http", "api", "request", "endpoint", "rest", "graphql", "webhook"],
        estimated_duration_seconds=3,
    ),
    # -- Database ------------------------------------------------------------
    ToolProfile(
        id="db_query",
        name="Database Query",
        category=ToolCategory.DATABASE,
        description="Execute read-only queries against the relational, graph, or cache layer.",
        trigger_capabilities=["memory"],
        trigger_skills=["database-engineering", "backend-engineer"],
        trigger_keywords=["query", "select", "database", "sql", "postgres", "neo4j", "redis"],
        estimated_duration_seconds=2,
        is_read_only=True,
    ),
    ToolProfile(
        id="db_write",
        name="Database Write",
        category=ToolCategory.DATABASE,
        description="Insert, update, or delete data in the database layer.",
        required_permissions=["write"],
        trigger_capabilities=["memory"],
        trigger_skills=["database-engineering", "backend-engineer"],
        trigger_keywords=["insert", "update", "delete", "upsert", "migrate", "schema"],
        estimated_duration_seconds=5,
    ),
    # -- Vector Store --------------------------------------------------------
    ToolProfile(
        id="vector_search",
        name="Vector Search",
        category=ToolCategory.VECTOR_STORE,
        description="Perform semantic similarity search in the Qdrant vector store.",
        trigger_capabilities=["memory"],
        trigger_skills=["data-science-ai", "backend-engineer"],
        trigger_keywords=["vector", "semantic", "similarity", "embedding", "qdrant", "search"],
        estimated_duration_seconds=2,
        is_read_only=True,
    ),
    ToolProfile(
        id="vector_upsert",
        name="Vector Upsert",
        category=ToolCategory.VECTOR_STORE,
        description="Upsert document embeddings into the vector store.",
        required_permissions=["write"],
        trigger_capabilities=["memory"],
        trigger_skills=["data-science-ai"],
        trigger_keywords=["embed", "upsert", "index", "vector store"],
        estimated_duration_seconds=5,
    ),
    # -- MCP -----------------------------------------------------------------
    ToolProfile(
        id="mcp_call",
        name="MCP Tool Call",
        category=ToolCategory.MCP,
        description="Invoke a tool exposed by an MCP (Model Context Protocol) server.",
        trigger_capabilities=["agent_runtime"],
        trigger_skills=["backend-engineer"],
        trigger_keywords=["mcp", "tool call", "external tool"],
        estimated_duration_seconds=5,
    ),
    # -- Local Script --------------------------------------------------------
    ToolProfile(
        id="local_script",
        name="Local Script",
        category=ToolCategory.LOCAL_SCRIPT,
        description="Execute a workspace-local script (bash, PowerShell, Makefile target, etc.).",
        required_permissions=["execute"],
        trigger_capabilities=["workspace"],
        trigger_skills=["devops"],
        trigger_keywords=["script", "makefile", "bash", "powershell", "sh", "make"],
        estimated_duration_seconds=15,
    ),
]


# ---------------------------------------------------------------------------
# Tool Orchestrator Subsystem
# ---------------------------------------------------------------------------


class ToolOrchestrator(PrismSubsystem):
    """
    Subsystem that analyses each ExecutionTask (after routing) and generates a
    ToolExecutionPlan describing which tools are required, their execution order,
    and the dependency graph.

    This subsystem is provider-independent and does NOT execute any tool.
    """

    def __init__(self) -> None:
        super().__init__(
            SubsystemMetadata(
                name="tool_orchestrator",
                version="1.0.0",
                description=(
                    "Determines required tools for ExecutionTasks and produces "
                    "ToolExecutionPlans. Does not execute tools."
                ),
                dependencies=[
                    "configuration",
                    "capability_registry",
                ],
            )
        )
        self._profiles: Dict[str, ToolProfile] = {}
        self._registry: Any = None
        self._load_builtin_profiles()

    # -------------------------------------------------------------------------
    # Lifecycle
    # -------------------------------------------------------------------------

    def _load_builtin_profiles(self) -> None:
        """Register all built-in tool profiles into the local catalogue."""
        for profile in _BUILTIN_PROFILES:
            self._profiles[profile.id] = profile
        logger.debug(
            "Tool Orchestrator: loaded %d built-in tool profiles.", len(self._profiles)
        )

    async def initialize(self, registry: Any) -> None:
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"
        self._registry = registry

        # Advertise capability
        try:
            cap_registry = await registry.lookup("capability_registry")
            cap_registry.register(
                Capability(
                    CapabilityMetadata(
                        id="tool_orchestrator",
                        name="Tool Orchestrator",
                        version="1.0.0",
                        description=(
                            "Determines required tools for ExecutionTasks and produces "
                            "ToolExecutionPlans without executing any tool."
                        ),
                    )
                )
            )
        except Exception as exc:
            logger.warning("Could not register tool_orchestrator capability: %s", exc)

        self.metadata.status = "active"
        self.metadata.health = "healthy"
        logger.info(
            "Tool Orchestrator initialized with %d tool profiles.", len(self._profiles)
        )

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    def register_profile(self, profile: ToolProfile) -> None:
        """Register a custom tool profile (idempotent; last write wins)."""
        self._profiles[profile.id] = profile
        logger.info("Tool Orchestrator: registered custom profile '%s'.", profile.id)

    def get_profiles(self) -> Dict[str, Dict[str, Any]]:
        """Return all registered tool profiles as plain dictionaries."""
        return {pid: p.model_dump() for pid, p in self._profiles.items()}

    def orchestrate(
        self,
        task: Any,
        routing_decision: Any = None,
        context: Any = None,
    ) -> ToolExecutionPlan:
        """
        Analyse *task* and return a :class:`ToolExecutionPlan`.

        Parameters
        ----------
        task:
            An ``ExecutionTask`` instance (from ``prism.core.planner``).
        routing_decision:
            The ``RoutingDecision`` produced by the Model Router for this task.
        context:
            The live ``Context`` snapshot from the Context Engine (optional).

        Returns
        -------
        ToolExecutionPlan
            A fully resolved plan.  No I/O is performed.
        """
        routing_id: Optional[str] = None
        if routing_decision and hasattr(routing_decision, "id"):
            routing_id = routing_decision.id

        required, optional, validation = self._select_tools(task, routing_decision, context)

        execution_order = self._build_execution_order(required, optional, validation)
        dependency_graph = self._build_dependency_graph(required, optional, validation)

        seq_time = sum(r.estimated_duration_seconds for r in required + validation)
        par_time = self._estimate_parallel_runtime(
            execution_order, required + optional + validation
        )

        plan = ToolExecutionPlan(
            task_id=task.id,
            task_name=task.name,
            routing_decision_id=routing_id,
            required_tools=required,
            optional_tools=optional,
            validation_tools=validation,
            execution_order=execution_order,
            dependency_graph=dependency_graph,
            estimated_runtime_seconds=seq_time,
            estimated_parallel_runtime_seconds=par_time,
            metadata={
                "task_phase": getattr(task, "phase", "unknown"),
                "task_complexity": getattr(task, "estimated_complexity", "unknown"),
                "capabilities": getattr(task, "required_capabilities", []),
                "skills": getattr(task, "required_skills", []),
                "required_tools_hint": getattr(task, "required_tools", []),
            },
        )

        logger.info(
            "ToolExecutionPlan generated: task=%s | required=%d, optional=%d, "
            "validation=%d, est_seq=%ds, est_par=%ds",
            task.id,
            len(required),
            len(optional),
            len(validation),
            seq_time,
            par_time,
        )
        return plan

    def orchestrate_plan(
        self,
        execution_plan: Any,
        context: Any = None,
    ) -> List[ToolExecutionPlan]:
        """
        Convenience wrapper: orchestrate every task in an ``ExecutionPlan``
        and return the list of ``ToolExecutionPlan`` instances in task order.
        """
        results: List[ToolExecutionPlan] = []
        for stage in execution_plan.stages:
            for task in stage.tasks:
                routing_decision = getattr(task, "routing_decision", None)
                tep = self.orchestrate(task, routing_decision, context)
                results.append(tep)
        logger.info(
            "orchestrate_plan: generated %d ToolExecutionPlans for plan %s.",
            len(results),
            execution_plan.id,
        )
        return results

    # -------------------------------------------------------------------------
    # Private Helpers
    # -------------------------------------------------------------------------

    def _select_tools(
        self,
        task: Any,
        routing_decision: Any,
        context: Any,
    ) -> tuple[List[ToolRequirement], List[ToolRequirement], List[ToolRequirement]]:
        """
        Select required, optional, and validation tools for *task*.

        Selection criteria (in descending priority):
        1. Explicit ``task.required_tools`` hints.
        2. Capability matches via ``task.required_capabilities``.
        3. Skill matches via ``task.required_skills``.
        4. Keyword matches against ``task.name`` and ``task.description``.
        5. Checkpoint type (validation / reflection).
        """
        required: List[ToolRequirement] = []
        optional: List[ToolRequirement] = []
        validation: List[ToolRequirement] = []

        task_caps: List[str] = list(getattr(task, "required_capabilities", []) or [])
        task_skills: List[str] = list(getattr(task, "required_skills", []) or [])
        task_tools_hint: List[str] = list(getattr(task, "required_tools", []) or [])
        task_name_lower: str = (getattr(task, "name", "") or "").lower()
        task_desc_lower: str = (getattr(task, "description", "") or "").lower()
        is_validation_cp: bool = bool(getattr(task, "is_validation_checkpoint", False))
        is_reflection_cp: bool = bool(getattr(task, "is_reflection_checkpoint", False))

        # Track which profiles were already selected to avoid duplicates
        # Use separate sets per bucket so checkpoint tools always appear in validation.
        selected_required: set = set()
        selected_optional: set = set()
        selected_validation: set = set()

        def _bucket_set(bucket: List[ToolRequirement]) -> set:
            if bucket is required:
                return selected_required
            if bucket is optional:
                return selected_optional
            return selected_validation

        def _add(
            profile: ToolProfile, prio: ToolPriority, bucket: List[ToolRequirement]
        ) -> None:
            bset = _bucket_set(bucket)
            if profile.id in bset:
                return
            bset.add(profile.id)
            req = ToolRequirement(
                tool_id=profile.id,
                tool_name=profile.name,
                category=profile.category,
                priority=prio,
                execution_mode=ToolExecutionMode.SEQUENTIAL,
                estimated_duration_seconds=profile.estimated_duration_seconds,
                rationale=self._rationale(profile, task_caps, task_skills, task_tools_hint),
            )
            bucket.append(req)

        # Convenience: add to required only if not already in any bucket
        def _add_req(profile: ToolProfile, prio: ToolPriority) -> None:
            if profile.id not in selected_required:
                _add(profile, prio, required)

        # 1. Explicit required_tools hints
        for hint in task_tools_hint:
            for profile in self._profiles.values():
                if hint.lower() in profile.id.lower() or hint.lower() in profile.name.lower():
                    _add_req(profile, ToolPriority.CRITICAL)

        # 2. Capability matches
        for cap in task_caps:
            for profile in self._profiles.values():
                if cap in profile.trigger_capabilities:
                    priority = ToolPriority.HIGH if profile.is_read_only else ToolPriority.CRITICAL
                    _add_req(profile, priority)

        # 3. Skill matches
        for skill in task_skills:
            for profile in self._profiles.values():
                if skill in profile.trigger_skills:
                    if profile.id not in selected_required and profile.id not in selected_optional:
                        _add(profile, ToolPriority.HIGH, optional)

        # 4. Keyword matches against task name and description
        combined_text = f"{task_name_lower} {task_desc_lower}"
        for profile in self._profiles.values():
            for kw in profile.trigger_keywords:
                if kw.lower() in combined_text:
                    if (profile.id not in selected_required
                            and profile.id not in selected_optional):
                        _add(profile, ToolPriority.MEDIUM, optional)
                    break

        # 5. Validation / reflection checkpoint tools
        if is_validation_cp:
            _add(self._profiles["python_exec"], ToolPriority.CRITICAL, validation)
            _add(self._profiles["python_lint"], ToolPriority.HIGH, validation)
            _add(self._profiles["terminal_exec"], ToolPriority.HIGH, validation)

        if is_reflection_cp:
            _add(self._profiles["git_read"], ToolPriority.MEDIUM, optional)
            _add(self._profiles["db_query"], ToolPriority.MEDIUM, optional)

        # Always add fs_read when the task has any work to do
        if task_caps or task_skills or task_tools_hint:
            _add(self._profiles["fs_read"], ToolPriority.HIGH, required)

        # Wire sequential dependencies within each bucket
        self._wire_sequential_deps(required)
        self._wire_sequential_deps(validation)

        return required, optional, validation

    def _rationale(
        self,
        profile: ToolProfile,
        caps: List[str],
        skills: List[str],
        hints: List[str],
    ) -> str:
        parts: List[str] = []
        matched_caps = [c for c in caps if c in profile.trigger_capabilities]
        matched_skills = [s for s in skills if s in profile.trigger_skills]
        matched_hints = [
            h for h in hints
            if h.lower() in profile.id.lower() or h.lower() in profile.name.lower()
        ]
        if matched_hints:
            parts.append(f"explicit hint: {matched_hints}")
        if matched_caps:
            parts.append(f"capability match: {matched_caps}")
        if matched_skills:
            parts.append(f"skill match: {matched_skills}")
        return "; ".join(parts) if parts else "keyword/context match"

    def _wire_sequential_deps(self, reqs: List[ToolRequirement]) -> None:
        """Make each requirement depend on the previous one (linear chain)."""
        for i in range(1, len(reqs)):
            if reqs[i - 1].id not in reqs[i].depends_on:
                reqs[i].depends_on.append(reqs[i - 1].id)

    def _build_execution_order(
        self,
        required: List[ToolRequirement],
        optional: List[ToolRequirement],
        validation: List[ToolRequirement],
    ) -> List[List[str]]:
        """
        Build execution order groups.

        Group 0: All required tools (critical path, sequential within group).
        Group 1: Optional tools (can run after required completes).
        Group 2: Validation tools (run after optional, sequential).
        """
        order: List[List[str]] = []
        if required:
            order.append([r.id for r in required])
        if optional:
            order.append([r.id for r in optional])
        if validation:
            order.append([r.id for r in validation])
        return order

    def _build_dependency_graph(
        self,
        required: List[ToolRequirement],
        optional: List[ToolRequirement],
        validation: List[ToolRequirement],
    ) -> Dict[str, List[str]]:
        """
        Build a forward dependency graph:
            key   = requirement_id
            value = list of requirement IDs that depend ON this node
        """
        all_reqs: List[ToolRequirement] = required + optional + validation
        graph: Dict[str, List[str]] = {r.id: [] for r in all_reqs}

        for req in all_reqs:
            for dep_id in req.depends_on:
                if dep_id in graph:
                    graph[dep_id].append(req.id)

        # Optional tools start after the last required tool completes
        if required and optional:
            last_req_id = required[-1].id
            for opt in optional:
                if opt.id not in graph.get(last_req_id, []):
                    graph[last_req_id].append(opt.id)

        # Validation tools start after optional (or required if no optional)
        if validation:
            trigger_id = (
                optional[-1].id if optional else (required[-1].id if required else None)
            )
            if trigger_id:
                for val in validation:
                    if val.id not in graph.get(trigger_id, []):
                        graph[trigger_id].append(val.id)

        return graph

    def _estimate_parallel_runtime(
        self,
        execution_order: List[List[str]],
        all_reqs: List[ToolRequirement],
    ) -> int:
        """
        Estimate wall-clock time assuming all tools within the same execution
        group run in parallel (maximum concurrency).
        """
        req_map: Dict[str, ToolRequirement] = {r.id: r for r in all_reqs}
        total = 0
        for group in execution_order:
            group_max = max(
                (req_map[rid].estimated_duration_seconds for rid in group if rid in req_map),
                default=0,
            )
            total += group_max
        return total


# Module-level singleton
tool_orchestrator = ToolOrchestrator()
