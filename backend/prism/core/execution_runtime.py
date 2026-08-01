"""PRISM Execution Runtime Subsystem.

Manages the full lifecycle of task execution within the PRISM platform.

Pipeline position:
    Tool Orchestrator (ToolExecutionPlan) -> Execution Runtime -> ExecutionSession

The Execution Runtime:
  - Consumes ToolExecutionPlans produced by the Tool Orchestrator.
  - Manages ExecutionSession lifecycle: Pending -> Queued -> Running -> Succeeded/Failed/Cancelled.
  - Supports pause/resume, retry policy, cancellation, event emission, progress tracking,
    and artifact registration.
  - Does NOT execute real tools yet. Uses MockExecutors to simulate lifecycle progression.
  - Defines a clean Executor interface for future tool implementations.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Awaitable

from pydantic import BaseModel, Field

from prism.core.capability import Capability, CapabilityMetadata
from prism.core.mind_registry import PrismSubsystem, SubsystemMetadata
from prism.core.tool_orchestrator import ToolExecutionPlan, ToolRequirement, ToolCategory

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class ExecutionState(str, Enum):
    """Lifecycle states for an ExecutionSession or individual task execution."""

    PENDING = "pending"       # Created, not yet queued
    QUEUED = "queued"         # Waiting in the run queue
    RUNNING = "running"       # Actively executing
    PAUSED = "paused"         # Paused by operator or policy; can be resumed
    RETRYING = "retrying"     # Waiting before a retry attempt
    SUCCEEDED = "succeeded"   # Completed successfully
    FAILED = "failed"         # Terminated with unrecoverable error
    CANCELLED = "cancelled"   # Cancelled by operator or timeout policy
    COMPLETED = "completed"   # Terminal state wrapping succeeded/failed/cancelled


# Valid state transitions map: {from_state: {allowed_to_states}}
_VALID_TRANSITIONS: Dict[ExecutionState, set] = {
    ExecutionState.PENDING:   {ExecutionState.QUEUED, ExecutionState.CANCELLED},
    ExecutionState.QUEUED:    {ExecutionState.RUNNING, ExecutionState.CANCELLED},
    ExecutionState.RUNNING:   {
        ExecutionState.PAUSED,
        ExecutionState.RETRYING,
        ExecutionState.SUCCEEDED,
        ExecutionState.FAILED,
        ExecutionState.CANCELLED,
    },
    ExecutionState.PAUSED:    {ExecutionState.RUNNING, ExecutionState.CANCELLED},
    ExecutionState.RETRYING:  {ExecutionState.RUNNING, ExecutionState.FAILED, ExecutionState.CANCELLED},
    ExecutionState.SUCCEEDED: {ExecutionState.COMPLETED},
    ExecutionState.FAILED:    {ExecutionState.COMPLETED},
    ExecutionState.CANCELLED: {ExecutionState.COMPLETED},
    ExecutionState.COMPLETED: set(),  # terminal
}


class ExecutionEventType(str, Enum):
    """Types of events emitted during execution lifecycle."""

    SESSION_CREATED = "session_created"
    SESSION_QUEUED = "session_queued"
    SESSION_STARTED = "session_started"
    SESSION_PAUSED = "session_paused"
    SESSION_RESUMED = "session_resumed"
    SESSION_RETRYING = "session_retrying"
    SESSION_SUCCEEDED = "session_succeeded"
    SESSION_FAILED = "session_failed"
    SESSION_CANCELLED = "session_cancelled"
    SESSION_COMPLETED = "session_completed"

    TASK_STARTED = "task_started"
    TASK_SUCCEEDED = "task_succeeded"
    TASK_FAILED = "task_failed"
    TASK_SKIPPED = "task_skipped"

    ARTIFACT_REGISTERED = "artifact_registered"
    PROGRESS_UPDATED = "progress_updated"
    RETRY_SCHEDULED = "retry_scheduled"
    CANCELLATION_REQUESTED = "cancellation_requested"


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------


class RetryPolicy(BaseModel):
    """Policy controlling retry behaviour for a session."""

    max_attempts: int = 3
    backoff_seconds: float = 2.0
    backoff_multiplier: float = 2.0
    max_backoff_seconds: float = 30.0
    retry_on_states: List[ExecutionState] = Field(
        default_factory=lambda: [ExecutionState.FAILED]
    )


class ExecutionEvent(BaseModel):
    """An event emitted during execution lifecycle."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    event_type: ExecutionEventType
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    state_from: Optional[ExecutionState] = None
    state_to: Optional[ExecutionState] = None
    task_id: Optional[str] = None
    tool_id: Optional[str] = None
    message: str = ""
    data: Dict[str, Any] = Field(default_factory=dict)


class ExecutionArtifact(BaseModel):
    """An artifact produced during task execution."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    task_id: Optional[str] = None
    tool_id: Optional[str] = None
    name: str
    artifact_type: str  # e.g. "file", "stdout", "json", "diff", "log"
    content_summary: str = ""
    path: Optional[str] = None
    size_bytes: int = 0
    registered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RuntimeMetrics(BaseModel):
    """Aggregate metrics for an ExecutionSession."""

    total_tasks: int = 0
    tasks_succeeded: int = 0
    tasks_failed: int = 0
    tasks_skipped: int = 0
    tasks_pending: int = 0

    total_tool_calls: int = 0
    tool_calls_succeeded: int = 0
    tool_calls_failed: int = 0

    retry_count: int = 0

    queued_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    resumed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    elapsed_seconds: float = 0.0
    estimated_remaining_seconds: float = 0.0

    artifacts_registered: int = 0

    @property
    def progress_percent(self) -> float:
        """0–100 progress based on task completion."""
        if self.total_tasks == 0:
            return 0.0
        done = self.tasks_succeeded + self.tasks_failed + self.tasks_skipped
        return round((done / self.total_tasks) * 100.0, 1)

    def model_dump(self, **kwargs) -> Dict[str, Any]:
        d = super().model_dump(**kwargs)
        d["progress_percent"] = self.progress_percent
        return d


class ExecutionSession(BaseModel):
    """Represents the full lifecycle of one ToolExecutionPlan being executed."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    plan_id: str
    task_id: str
    task_name: str

    state: ExecutionState = ExecutionState.PENDING
    attempt: int = 1
    retry_policy: RetryPolicy = Field(default_factory=RetryPolicy)

    events: List[ExecutionEvent] = Field(default_factory=list)
    artifacts: List[ExecutionArtifact] = Field(default_factory=list)
    metrics: RuntimeMetrics = Field(default_factory=RuntimeMetrics)

    # Snapshot of the plan at the time of session creation
    plan_snapshot: Optional[Dict[str, Any]] = None

    error_message: Optional[str] = None
    cancellation_reason: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        use_enum_values = False

    def transition_to(self, new_state: ExecutionState) -> ExecutionEvent:
        """
        Validate and apply a state transition.

        Raises
        ------
        ValueError
            If the transition is not permitted by the state machine.
        """
        allowed = _VALID_TRANSITIONS.get(self.state, set())
        if new_state not in allowed:
            raise ValueError(
                f"Invalid state transition: {self.state!r} → {new_state!r}. "
                f"Allowed: {[s.value for s in allowed]}"
            )

        event_type_map: Dict[ExecutionState, ExecutionEventType] = {
            ExecutionState.QUEUED:    ExecutionEventType.SESSION_QUEUED,
            ExecutionState.RUNNING:   ExecutionEventType.SESSION_STARTED,
            ExecutionState.PAUSED:    ExecutionEventType.SESSION_PAUSED,
            ExecutionState.RETRYING:  ExecutionEventType.SESSION_RETRYING,
            ExecutionState.SUCCEEDED: ExecutionEventType.SESSION_SUCCEEDED,
            ExecutionState.FAILED:    ExecutionEventType.SESSION_FAILED,
            ExecutionState.CANCELLED: ExecutionEventType.SESSION_CANCELLED,
            ExecutionState.COMPLETED: ExecutionEventType.SESSION_COMPLETED,
        }

        old_state = self.state
        self.state = new_state
        self.updated_at = datetime.now(timezone.utc)

        event = ExecutionEvent(
            session_id=self.id,
            event_type=event_type_map.get(new_state, ExecutionEventType.PROGRESS_UPDATED),
            state_from=old_state,
            state_to=new_state,
        )
        self.events.append(event)
        return event

    def register_artifact(self, artifact: ExecutionArtifact) -> None:
        """Register a produced artifact in this session."""
        self.artifacts.append(artifact)
        self.metrics.artifacts_registered += 1
        self.updated_at = datetime.now(timezone.utc)

    def emit(self, event: ExecutionEvent) -> None:
        """Append an arbitrary event to the event log."""
        self.events.append(event)
        self.updated_at = datetime.now(timezone.utc)

    def add_task_event(
        self,
        event_type: ExecutionEventType,
        task_id: str,
        tool_id: Optional[str] = None,
        message: str = "",
        data: Optional[Dict[str, Any]] = None,
    ) -> ExecutionEvent:
        """Create and append a task-level event."""
        event = ExecutionEvent(
            session_id=self.id,
            event_type=event_type,
            task_id=task_id,
            tool_id=tool_id,
            message=message,
            data=data or {},
        )
        self.events.append(event)
        return event

    @property
    def is_terminal(self) -> bool:
        return self.state == ExecutionState.COMPLETED

    @property
    def is_active(self) -> bool:
        return self.state in (ExecutionState.RUNNING, ExecutionState.PAUSED)


# ---------------------------------------------------------------------------
# Executor Interface
# ---------------------------------------------------------------------------


class ExecutorResult(BaseModel):
    """Result returned by any Executor implementation."""

    succeeded: bool
    output: Optional[str] = None
    error: Optional[str] = None
    artifacts: List[ExecutionArtifact] = Field(default_factory=list)
    elapsed_seconds: float = 0.0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BaseExecutor(ABC):
    """
    Abstract interface for all PRISM tool executors.

    Each tool category (Filesystem, Terminal, Git, Docker, Python, Browser,
    HTTP, Database, VectorStore, MCP, LocalScript) will implement this interface.

    Implementors must:
      - Honour cancellation via `cancel()`.
      - Never block the event loop; use `asyncio` primitives.
      - Return an `ExecutorResult` always (never raise uncaught exceptions).
      - Register artifacts in the result, not as side effects.
    """

    @property
    @abstractmethod
    def supported_category(self) -> ToolCategory:
        """The ToolCategory this executor handles."""

    @abstractmethod
    async def execute(
        self,
        requirement: ToolRequirement,
        session: ExecutionSession,
        context: Optional[Dict[str, Any]] = None,
    ) -> ExecutorResult:
        """
        Execute a single ToolRequirement within a session context.

        Parameters
        ----------
        requirement : ToolRequirement
            The resolved tool requirement to execute.
        session : ExecutionSession
            The owning session (read-only reference for context).
        context : dict, optional
            Additional runtime context (workspace path, env vars, etc.).

        Returns
        -------
        ExecutorResult
            Always returns a result; never raises.
        """

    async def cancel(self) -> None:
        """Request cancellation of any in-flight work. Override when needed."""

    async def health_check(self) -> bool:
        """Return True if this executor is available. Override when needed."""
        return True


# ---------------------------------------------------------------------------
# Mock Executor (Simulates lifecycle without real tool execution)
# ---------------------------------------------------------------------------


class MockExecutor(BaseExecutor):
    """
    Simulates tool execution for any ToolCategory.

    Used during development when real tool backends are not yet implemented.
    Produces synthetic artifacts and obeys configurable success/failure rates.
    """

    def __init__(
        self,
        category: ToolCategory,
        success_rate: float = 1.0,
        simulated_duration: float = 0.05,
    ):
        self._category = category
        self._success_rate = success_rate
        self._simulated_duration = simulated_duration
        self._cancelled = False

    @property
    def supported_category(self) -> ToolCategory:
        return self._category

    async def execute(
        self,
        requirement: ToolRequirement,
        session: ExecutionSession,
        context: Optional[Dict[str, Any]] = None,
    ) -> ExecutorResult:
        """Simulate execution by sleeping for the configured duration."""
        import random

        await asyncio.sleep(self._simulated_duration)

        if self._cancelled:
            return ExecutorResult(succeeded=False, error="Cancelled before execution.")

        success = random.random() < self._success_rate
        artifact = ExecutionArtifact(
            session_id=session.id,
            task_id=session.task_id,
            tool_id=requirement.tool_id,
            name=f"{requirement.tool_id}_mock_output",
            artifact_type="mock",
            content_summary=f"[MOCK] Simulated output for {requirement.tool_name}.",
            size_bytes=512,
        )

        return ExecutorResult(
            succeeded=success,
            output=f"[MOCK] {requirement.tool_name} completed." if success else None,
            error=None if success else f"[MOCK] {requirement.tool_name} simulated failure.",
            artifacts=[artifact],
            elapsed_seconds=self._simulated_duration,
            metadata={"simulated": True, "category": self._category.value},
        )

    async def cancel(self) -> None:
        self._cancelled = True


# ---------------------------------------------------------------------------
# Executor Registry
# ---------------------------------------------------------------------------


class ExecutorRegistry:
    """
    Maps ToolCategory to a registered BaseExecutor implementation.
    Falls back to MockExecutor for any category without a real implementation.
    """

    def __init__(self):
        self._executors: Dict[ToolCategory, BaseExecutor] = {}
        self._mock_fallback: bool = True

    def register(self, executor: BaseExecutor) -> None:
        """Register an executor for its supported category."""
        self._executors[executor.supported_category] = executor
        logger.info("Registered executor for category: %s", executor.supported_category.value)

    def get(self, category: ToolCategory) -> BaseExecutor:
        """Retrieve the executor for a category; falls back to MockExecutor."""
        if category in self._executors:
            return self._executors[category]
        if self._mock_fallback:
            logger.debug("No real executor for %s — using MockExecutor.", category.value)
            return MockExecutor(category)
        raise KeyError(f"No executor registered for category: {category.value}")

    def set_mock_fallback(self, enabled: bool) -> None:
        self._mock_fallback = enabled


# ---------------------------------------------------------------------------
# Execution Runtime Subsystem
# ---------------------------------------------------------------------------


class ExecutionRuntime(PrismSubsystem):
    """
    PRISM Execution Runtime — lifecycle manager for ToolExecutionPlan execution.

    Responsibilities
    ----------------
    - Accepts ToolExecutionPlans and creates ExecutionSessions.
    - Drives state transitions through the full lifecycle state machine.
    - Manages retry policy, pause/resume, and cancellation.
    - Delegates tool invocation to registered Executor implementations.
    - Emits ExecutionEvents for observability.
    - Tracks progress and registers artifacts.
    - Does NOT execute real tools by default; MockExecutors simulate all work.

    Thread-safety
    -------------
    All public methods are async-safe for use in a single asyncio event loop.
    Concurrent session execution uses asyncio.gather with per-session isolation.
    """

    def __init__(self):
        super().__init__(SubsystemMetadata(
            name="execution_runtime",
            version="1.0.0",
            description=(
                "Manages the full lifecycle of task execution: session creation, "
                "state transitions, retry policy, pause/resume, cancellation, "
                "event emission, progress tracking, and artifact registration."
            ),
            dependencies=[
                "capability_registry",
                "tool_orchestrator",
                "cognitive_planner",
                "model_router",
                "event_bus",
            ],
        ))

        self._sessions: Dict[str, ExecutionSession] = {}
        self._executor_registry = ExecutorRegistry()
        self._event_bus: Optional[Any] = None
        self._cancellation_flags: Dict[str, bool] = {}
        self._pause_events: Dict[str, asyncio.Event] = {}
        self._global_event_handlers: List[Callable[[ExecutionEvent], Awaitable[None]]] = []

    # -------------------------------------------------------------------------
    # Initialization
    # -------------------------------------------------------------------------

    async def initialize(self, registry: Any) -> None:
        """Initialize the Execution Runtime and register its capability."""
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"

        # Wire event bus
        try:
            self._event_bus = await registry.lookup("event_bus")
        except KeyError:
            logger.warning("Event Bus not available — runtime events will not be published.")

        # Register mock executors for all tool categories (fallback chain)
        for category in ToolCategory:
            self._executor_registry.register(MockExecutor(category))

        # Register capability
        try:
            cap_registry = await registry.lookup("capability_registry")
            cap_registry.register(Capability(CapabilityMetadata(
                id="execution_runtime",
                name="Execution Runtime",
                version="1.0.0",
                description=(
                    "Manages execution lifecycle: sessions, state transitions, retry, "
                    "pause/resume, cancellation, events, progress, and artifacts."
                ),
            )))
        except Exception as exc:
            logger.warning("Could not register execution_runtime capability: %s", exc)

        self.metadata.status = "active"
        self.metadata.health = "healthy"
        logger.info("Execution Runtime initialized.")

    # -------------------------------------------------------------------------
    # Public API — Session Management
    # -------------------------------------------------------------------------

    def create_session(
        self,
        plan: ToolExecutionPlan,
        retry_policy: Optional[RetryPolicy] = None,
    ) -> ExecutionSession:
        """
        Create an ExecutionSession from a ToolExecutionPlan.

        Parameters
        ----------
        plan : ToolExecutionPlan
            The fully resolved plan from the Tool Orchestrator.
        retry_policy : RetryPolicy, optional
            Override the default retry policy.

        Returns
        -------
        ExecutionSession
            A new session in PENDING state.
        """
        total_tasks = (
            len(plan.required_tools)
            + len(plan.optional_tools)
            + len(plan.validation_tools)
        )

        session = ExecutionSession(
            plan_id=plan.id,
            task_id=plan.task_id,
            task_name=plan.task_name,
            retry_policy=retry_policy or RetryPolicy(),
            plan_snapshot=plan.model_dump(),
            metrics=RuntimeMetrics(
                total_tasks=total_tasks,
                tasks_pending=total_tasks,
                estimated_remaining_seconds=plan.estimated_runtime_seconds,
            ),
        )

        self._sessions[session.id] = session
        self._cancellation_flags[session.id] = False
        self._pause_events[session.id] = asyncio.Event()
        self._pause_events[session.id].set()  # not paused initially

        # Emit creation event
        creation_event = ExecutionEvent(
            session_id=session.id,
            event_type=ExecutionEventType.SESSION_CREATED,
            state_from=None,
            state_to=ExecutionState.PENDING,
            message=f"Session created for plan {plan.id}.",
        )
        session.emit(creation_event)
        self._publish_event_sync(creation_event)

        logger.info(
            "ExecutionSession %s created (plan=%s, tasks=%d).",
            session.id, plan.id, total_tasks,
        )
        return session

    def get_session(self, session_id: str) -> ExecutionSession:
        """Retrieve an existing session by ID."""
        if session_id not in self._sessions:
            raise KeyError(f"ExecutionSession '{session_id}' not found.")
        return self._sessions[session_id]

    def list_sessions(self) -> List[Dict[str, Any]]:
        """Return summary metadata for all sessions."""
        return [
            {
                "id": s.id,
                "plan_id": s.plan_id,
                "task_id": s.task_id,
                "task_name": s.task_name,
                "state": s.state.value,
                "attempt": s.attempt,
                "progress_percent": s.metrics.progress_percent,
                "created_at": s.created_at.isoformat(),
            }
            for s in self._sessions.values()
        ]

    # -------------------------------------------------------------------------
    # Public API — Lifecycle Control
    # -------------------------------------------------------------------------

    async def run(
        self,
        session_id: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> ExecutionSession:
        """
        Drive a session through its complete lifecycle.

        Transitions: PENDING → QUEUED → RUNNING → (SUCCEEDED|FAILED|CANCELLED) → COMPLETED.

        Parameters
        ----------
        session_id : str
        context : dict, optional
            Runtime context forwarded to each executor.

        Returns
        -------
        ExecutionSession
            The completed session.
        """
        session = self.get_session(session_id)

        if session.is_terminal:
            logger.warning("Session %s is already terminal.", session_id)
            return session

        # PENDING → QUEUED
        event = session.transition_to(ExecutionState.QUEUED)
        session.metrics.queued_at = datetime.now(timezone.utc)
        self._publish_event_sync(event)

        # QUEUED → RUNNING (immediate — no external queue in this impl)
        event = session.transition_to(ExecutionState.RUNNING)
        session.metrics.started_at = datetime.now(timezone.utc)
        self._publish_event_sync(event)

        attempt = 1
        while attempt <= session.retry_policy.max_attempts:
            session.attempt = attempt
            success = await self._execute_plan(session, context)

            if success:
                event = session.transition_to(ExecutionState.SUCCEEDED)
                self._publish_event_sync(event)
                break

            # Check cancellation
            if self._cancellation_flags.get(session_id, False):
                event = session.transition_to(ExecutionState.CANCELLED)
                self._publish_event_sync(event)
                break

            # Decide whether to retry
            if attempt < session.retry_policy.max_attempts:
                session.metrics.retry_count += 1
                backoff = min(
                    session.retry_policy.backoff_seconds
                    * (session.retry_policy.backoff_multiplier ** (attempt - 1)),
                    session.retry_policy.max_backoff_seconds,
                )

                event = session.transition_to(ExecutionState.RETRYING)
                retry_event = ExecutionEvent(
                    session_id=session.id,
                    event_type=ExecutionEventType.RETRY_SCHEDULED,
                    message=f"Retry {attempt}/{session.retry_policy.max_attempts - 1} scheduled in {backoff:.1f}s.",
                    data={"backoff_seconds": backoff, "attempt": attempt},
                )
                session.emit(retry_event)
                self._publish_event_sync(event)
                self._publish_event_sync(retry_event)

                await asyncio.sleep(backoff)

                # RETRYING → RUNNING
                event = session.transition_to(ExecutionState.RUNNING)
                self._publish_event_sync(event)
            else:
                event = session.transition_to(ExecutionState.FAILED)
                self._publish_event_sync(event)

            attempt += 1

        # Finalize to COMPLETED
        if not session.is_terminal:
            event = session.transition_to(ExecutionState.COMPLETED)
            self._publish_event_sync(event)
        elif session.state != ExecutionState.COMPLETED:
            # The terminal transition from SUCCEEDED/FAILED/CANCELLED → COMPLETED
            try:
                event = session.transition_to(ExecutionState.COMPLETED)
                session.metrics.completed_at = datetime.now(timezone.utc)
                if session.metrics.started_at:
                    delta = datetime.now(timezone.utc) - session.metrics.started_at
                    session.metrics.elapsed_seconds = round(delta.total_seconds(), 3)
                self._publish_event_sync(event)
            except ValueError:
                # Already completed
                pass

        logger.info(
            "ExecutionSession %s finished: state=%s, progress=%.1f%%.",
            session_id, session.state.value, session.metrics.progress_percent,
        )
        return session

    async def pause(self, session_id: str) -> None:
        """Pause a running session."""
        session = self.get_session(session_id)
        if session.state != ExecutionState.RUNNING:
            raise ValueError(f"Cannot pause session in state: {session.state!r}")
        event = session.transition_to(ExecutionState.PAUSED)
        session.metrics.paused_at = datetime.now(timezone.utc)
        pause_event = self._pause_events.get(session_id)
        if pause_event:
            pause_event.clear()
        self._publish_event_sync(event)
        logger.info("Session %s paused.", session_id)

    async def resume(self, session_id: str) -> None:
        """Resume a paused session."""
        session = self.get_session(session_id)
        if session.state != ExecutionState.PAUSED:
            raise ValueError(f"Cannot resume session in state: {session.state!r}")
        event = session.transition_to(ExecutionState.RUNNING)
        session.metrics.resumed_at = datetime.now(timezone.utc)
        pause_event = self._pause_events.get(session_id)
        if pause_event:
            pause_event.set()
        resume_ev = ExecutionEvent(
            session_id=session_id,
            event_type=ExecutionEventType.SESSION_RESUMED,
            message="Session resumed.",
        )
        session.emit(resume_ev)
        self._publish_event_sync(event)
        self._publish_event_sync(resume_ev)
        logger.info("Session %s resumed.", session_id)

    async def cancel(self, session_id: str, reason: str = "Cancelled by operator.") -> None:
        """Request cancellation of a session."""
        session = self.get_session(session_id)
        self._cancellation_flags[session_id] = True
        session.cancellation_reason = reason

        # Unblock paused sessions
        pause_event = self._pause_events.get(session_id)
        if pause_event:
            pause_event.set()

        cancel_request_event = ExecutionEvent(
            session_id=session_id,
            event_type=ExecutionEventType.CANCELLATION_REQUESTED,
            message=reason,
        )
        session.emit(cancel_request_event)
        self._publish_event_sync(cancel_request_event)
        logger.info("Session %s cancellation requested: %s", session_id, reason)

    # -------------------------------------------------------------------------
    # Public API — Executor Management
    # -------------------------------------------------------------------------

    def register_executor(self, executor: BaseExecutor) -> None:
        """Register a real tool executor, overriding any mock for that category."""
        self._executor_registry.register(executor)

    def subscribe_to_events(
        self, handler: Callable[[ExecutionEvent], Awaitable[None]]
    ) -> None:
        """Subscribe a handler to receive all runtime events."""
        self._global_event_handlers.append(handler)

    # -------------------------------------------------------------------------
    # Private — Plan Execution
    # -------------------------------------------------------------------------

    async def _execute_plan(
        self,
        session: ExecutionSession,
        context: Optional[Dict[str, Any]],
    ) -> bool:
        """
        Execute all tool groups in the plan snapshot sequentially.

        Required tools → Optional tools → Validation tools.

        Returns True if all required and validation tools succeeded.
        """
        if not session.plan_snapshot:
            logger.warning("Session %s has no plan snapshot.", session.id)
            return True

        required = session.plan_snapshot.get("required_tools", [])
        optional = session.plan_snapshot.get("optional_tools", [])
        validation = session.plan_snapshot.get("validation_tools", [])

        # Execute required tools (any failure = plan failure)
        success = await self._execute_group(session, required, context, critical=True)
        if not success:
            return False

        # Execute optional tools (failures logged but don't abort)
        await self._execute_group(session, optional, context, critical=False)

        # Execute validation tools (any failure = plan failure)
        return await self._execute_group(session, validation, context, critical=True)

    async def _execute_group(
        self,
        session: ExecutionSession,
        tool_list: List[Dict[str, Any]],
        context: Optional[Dict[str, Any]],
        critical: bool,
    ) -> bool:
        """Execute a list of tool requirement dicts; return True if all critical ones passed."""
        all_ok = True
        for tool_dict in tool_list:
            # Check cancellation
            if self._cancellation_flags.get(session.id, False):
                return False

            # Honour pause
            pause_event = self._pause_events.get(session.id)
            if pause_event:
                await pause_event.wait()

            # Reconstruct a lightweight ToolRequirement from the snapshot dict
            try:
                req = ToolRequirement(**tool_dict)
            except Exception as exc:
                logger.error("Failed to reconstruct ToolRequirement: %s", exc)
                if critical:
                    all_ok = False
                continue

            # Emit task-started event
            task_started = session.add_task_event(
                ExecutionEventType.TASK_STARTED,
                task_id=session.task_id,
                tool_id=req.tool_id,
                message=f"Starting: {req.tool_name}",
            )
            self._publish_event_sync(task_started)

            # Get executor and run
            executor = self._executor_registry.get(req.category)
            try:
                result = await executor.execute(req, session, context)
            except Exception as exc:
                result = ExecutorResult(
                    succeeded=False,
                    error=str(exc),
                    elapsed_seconds=0.0,
                )

            # Update metrics and emit events
            if result.succeeded:
                session.metrics.tasks_succeeded += 1
                session.metrics.tool_calls_succeeded += 1
                for artifact in result.artifacts:
                    session.register_artifact(artifact)
                    art_event = ExecutionEvent(
                        session_id=session.id,
                        event_type=ExecutionEventType.ARTIFACT_REGISTERED,
                        task_id=session.task_id,
                        tool_id=req.tool_id,
                        message=f"Artifact: {artifact.name}",
                    )
                    session.emit(art_event)
                    self._publish_event_sync(art_event)

                task_done = session.add_task_event(
                    ExecutionEventType.TASK_SUCCEEDED,
                    task_id=session.task_id,
                    tool_id=req.tool_id,
                    message=result.output or f"{req.tool_name} succeeded.",
                    data={"elapsed_seconds": result.elapsed_seconds},
                )
                self._publish_event_sync(task_done)
            else:
                session.metrics.tasks_failed += 1
                session.metrics.tool_calls_failed += 1
                if critical:
                    all_ok = False
                    session.error_message = result.error

                task_fail = session.add_task_event(
                    ExecutionEventType.TASK_FAILED,
                    task_id=session.task_id,
                    tool_id=req.tool_id,
                    message=result.error or f"{req.tool_name} failed.",
                    data={"elapsed_seconds": result.elapsed_seconds},
                )
                self._publish_event_sync(task_fail)

            session.metrics.total_tool_calls += 1
            session.metrics.tasks_pending = max(
                0,
                session.metrics.tasks_pending - 1,
            )

            # Emit progress update
            progress_event = ExecutionEvent(
                session_id=session.id,
                event_type=ExecutionEventType.PROGRESS_UPDATED,
                data={
                    "progress_percent": session.metrics.progress_percent,
                    "tasks_succeeded": session.metrics.tasks_succeeded,
                    "tasks_failed": session.metrics.tasks_failed,
                },
            )
            session.emit(progress_event)
            self._publish_event_sync(progress_event)

            # If critical and failed, stop the group
            if critical and not all_ok:
                break

        return all_ok

    # -------------------------------------------------------------------------
    # Private — Event Publication
    # -------------------------------------------------------------------------

    def _publish_event_sync(self, event: ExecutionEvent) -> None:
        """
        Publish an event to global handlers synchronously (fire-and-forget).
        Also forwards to the EventBus if available.
        """
        for handler in self._global_event_handlers:
            try:
                asyncio.create_task(handler(event))
            except RuntimeError:
                # No running event loop (test context) — skip async dispatch
                pass

        if self._event_bus:
            try:
                asyncio.create_task(
                    self._event_bus.publish(
                        f"runtime.{event.event_type.value}",
                        event.model_dump(),
                    )
                )
            except RuntimeError:
                pass

    # -------------------------------------------------------------------------
    # Diagnostics
    # -------------------------------------------------------------------------

    def get_metrics(self, session_id: str) -> Dict[str, Any]:
        """Return metrics for a session."""
        session = self.get_session(session_id)
        return session.metrics.model_dump()

    def get_events(self, session_id: str) -> List[Dict[str, Any]]:
        """Return all events for a session."""
        session = self.get_session(session_id)
        return [e.model_dump() for e in session.events]

    def get_artifacts(self, session_id: str) -> List[Dict[str, Any]]:
        """Return all artifacts for a session."""
        session = self.get_session(session_id)
        return [a.model_dump() for a in session.artifacts]


# ---------------------------------------------------------------------------
# Module Singleton
# ---------------------------------------------------------------------------

execution_runtime = ExecutionRuntime()
