"""Unit tests for the PRISM Execution Runtime subsystem."""

import asyncio
import pytest
from types import SimpleNamespace
from typing import Any, Dict, Optional

from prism.core.execution_runtime import (
    ExecutionState,
    ExecutionEventType,
    ExecutionSession,
    ExecutionEvent,
    ExecutionArtifact,
    RuntimeMetrics,
    RetryPolicy,
    ExecutorResult,
    BaseExecutor,
    MockExecutor,
    ExecutorRegistry,
    ExecutionRuntime,
    _VALID_TRANSITIONS,
)
from prism.core.tool_orchestrator import (
    ToolExecutionPlan,
    ToolRequirement,
    ToolCategory,
    ToolPriority,
    ToolExecutionMode,
    ToolOrchestrator,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_plan(
    required_count: int = 2,
    optional_count: int = 1,
    validation_count: int = 1,
) -> ToolExecutionPlan:
    """Build a minimal ToolExecutionPlan for testing."""

    def _req(name: str, cat: ToolCategory = ToolCategory.FILESYSTEM) -> ToolRequirement:
        return ToolRequirement(
            tool_id=name,
            tool_name=name.replace("_", " ").title(),
            category=cat,
            priority=ToolPriority.HIGH,
            execution_mode=ToolExecutionMode.SEQUENTIAL,
            estimated_duration_seconds=1,
        )

    required = [_req(f"req_tool_{i}") for i in range(required_count)]
    optional = [_req(f"opt_tool_{i}", ToolCategory.GIT) for i in range(optional_count)]
    validation = [_req(f"val_tool_{i}", ToolCategory.PYTHON) for i in range(validation_count)]

    return ToolExecutionPlan(
        task_id="task-test-001",
        task_name="Test Task",
        required_tools=required,
        optional_tools=optional,
        validation_tools=validation,
        estimated_runtime_seconds=required_count + validation_count,
        estimated_parallel_runtime_seconds=required_count + validation_count,
    )


def _make_runtime() -> ExecutionRuntime:
    return ExecutionRuntime()


# ---------------------------------------------------------------------------
# State Machine
# ---------------------------------------------------------------------------


class TestStateMachine:
    def test_all_states_in_valid_transitions(self):
        for state in ExecutionState:
            assert state in _VALID_TRANSITIONS

    def test_pending_can_queue(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        assert session.state == ExecutionState.PENDING
        event = session.transition_to(ExecutionState.QUEUED)
        assert session.state == ExecutionState.QUEUED
        assert event.state_from == ExecutionState.PENDING
        assert event.state_to == ExecutionState.QUEUED

    def test_invalid_transition_raises(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        with pytest.raises(ValueError, match="Invalid state transition"):
            session.transition_to(ExecutionState.SUCCEEDED)

    def test_completed_is_terminal(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        session.transition_to(ExecutionState.QUEUED)
        session.transition_to(ExecutionState.RUNNING)
        session.transition_to(ExecutionState.SUCCEEDED)
        session.transition_to(ExecutionState.COMPLETED)
        assert session.is_terminal
        assert len(_VALID_TRANSITIONS[ExecutionState.COMPLETED]) == 0

    def test_running_can_pause_and_resume(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        session.transition_to(ExecutionState.QUEUED)
        session.transition_to(ExecutionState.RUNNING)
        session.transition_to(ExecutionState.PAUSED)
        assert session.state == ExecutionState.PAUSED
        session.transition_to(ExecutionState.RUNNING)
        assert session.state == ExecutionState.RUNNING

    def test_failed_transitions_to_completed(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        session.transition_to(ExecutionState.QUEUED)
        session.transition_to(ExecutionState.RUNNING)
        session.transition_to(ExecutionState.FAILED)
        session.transition_to(ExecutionState.COMPLETED)
        assert session.state == ExecutionState.COMPLETED

    def test_cancelled_transitions_to_completed(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        session.transition_to(ExecutionState.QUEUED)
        session.transition_to(ExecutionState.CANCELLED)
        session.transition_to(ExecutionState.COMPLETED)
        assert session.state == ExecutionState.COMPLETED

    def test_retrying_cycle(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        session.transition_to(ExecutionState.QUEUED)
        session.transition_to(ExecutionState.RUNNING)
        session.transition_to(ExecutionState.RETRYING)
        session.transition_to(ExecutionState.RUNNING)
        assert session.state == ExecutionState.RUNNING


# ---------------------------------------------------------------------------
# Session Creation
# ---------------------------------------------------------------------------


class TestSessionCreation:
    def test_create_session_pending_state(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        assert session.state == ExecutionState.PENDING
        assert session.plan_id == plan.id
        assert session.task_id == plan.task_id

    def test_create_session_correct_total_tasks(self):
        plan = _make_plan(required_count=3, optional_count=2, validation_count=1)
        rt = _make_runtime()
        session = rt.create_session(plan)
        assert session.metrics.total_tasks == 6

    def test_create_session_has_creation_event(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        assert len(session.events) == 1
        assert session.events[0].event_type == ExecutionEventType.SESSION_CREATED

    def test_session_stored_in_runtime(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        retrieved = rt.get_session(session.id)
        assert retrieved.id == session.id

    def test_get_session_unknown_raises(self):
        rt = _make_runtime()
        with pytest.raises(KeyError):
            rt.get_session("nonexistent")

    def test_list_sessions(self):
        plan1 = _make_plan()
        plan2 = _make_plan(required_count=1)
        rt = _make_runtime()
        s1 = rt.create_session(plan1)
        s2 = rt.create_session(plan2)
        listing = rt.list_sessions()
        ids = {item["id"] for item in listing}
        assert s1.id in ids
        assert s2.id in ids


# ---------------------------------------------------------------------------
# Artifacts
# ---------------------------------------------------------------------------


class TestArtifacts:
    def test_register_artifact(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        artifact = ExecutionArtifact(
            session_id=session.id,
            task_id=session.task_id,
            name="test_output.txt",
            artifact_type="file",
            content_summary="Test output.",
            size_bytes=256,
        )
        session.register_artifact(artifact)
        assert session.metrics.artifacts_registered == 1
        assert len(session.artifacts) == 1
        assert session.artifacts[0].name == "test_output.txt"


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


class TestMetrics:
    def test_progress_percent_zero_initially(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        assert session.metrics.progress_percent == 0.0

    def test_progress_percent_updates(self):
        plan = _make_plan(required_count=4, optional_count=0, validation_count=0)
        rt = _make_runtime()
        session = rt.create_session(plan)
        session.metrics.tasks_succeeded = 2
        assert session.metrics.progress_percent == 50.0

    def test_metrics_model_dump_includes_progress(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        d = session.metrics.model_dump()
        assert "progress_percent" in d


# ---------------------------------------------------------------------------
# Executor Interface
# ---------------------------------------------------------------------------


class TestMockExecutor:
    def test_supported_category(self):
        ex = MockExecutor(ToolCategory.FILESYSTEM)
        assert ex.supported_category == ToolCategory.FILESYSTEM

    @pytest.mark.asyncio
    async def test_execute_returns_result(self):
        ex = MockExecutor(ToolCategory.PYTHON, success_rate=1.0, simulated_duration=0.01)
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        req = ToolRequirement(
            tool_id="python_exec",
            tool_name="Python Exec",
            category=ToolCategory.PYTHON,
            priority=ToolPriority.HIGH,
            execution_mode=ToolExecutionMode.SEQUENTIAL,
        )
        result = await ex.execute(req, session)
        assert isinstance(result, ExecutorResult)
        assert result.succeeded is True
        assert len(result.artifacts) == 1

    @pytest.mark.asyncio
    async def test_cancelled_executor_fails(self):
        ex = MockExecutor(ToolCategory.TERMINAL, success_rate=1.0)
        await ex.cancel()
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        req = ToolRequirement(
            tool_id="terminal_exec",
            tool_name="Terminal",
            category=ToolCategory.TERMINAL,
            priority=ToolPriority.HIGH,
            execution_mode=ToolExecutionMode.SEQUENTIAL,
        )
        result = await ex.execute(req, session)
        assert result.succeeded is False
        assert "Cancelled" in result.error


class TestExecutorRegistry:
    def test_get_mock_fallback(self):
        reg = ExecutorRegistry()
        ex = reg.get(ToolCategory.DOCKER)
        assert isinstance(ex, MockExecutor)
        assert ex.supported_category == ToolCategory.DOCKER

    def test_register_overrides_mock(self):
        class RealDockerExecutor(BaseExecutor):
            @property
            def supported_category(self):
                return ToolCategory.DOCKER

            async def execute(self, requirement, session, context=None):
                return ExecutorResult(succeeded=True)

        reg = ExecutorRegistry()
        real = RealDockerExecutor()
        reg.register(real)
        ex = reg.get(ToolCategory.DOCKER)
        assert ex is real


# ---------------------------------------------------------------------------
# Full Lifecycle (async)
# ---------------------------------------------------------------------------


class TestLifecycle:
    @pytest.mark.asyncio
    async def test_run_completes_session(self):
        plan = _make_plan(required_count=2, optional_count=1, validation_count=1)
        rt = _make_runtime()
        session = rt.create_session(plan)
        result = await rt.run(session.id)
        assert result.is_terminal
        assert result.state == ExecutionState.COMPLETED

    @pytest.mark.asyncio
    async def test_run_emits_events(self):
        plan = _make_plan(required_count=1, optional_count=0, validation_count=0)
        rt = _make_runtime()
        session = rt.create_session(plan)
        result = await rt.run(session.id)
        event_types = {e.event_type for e in result.events}
        assert ExecutionEventType.SESSION_QUEUED in event_types
        assert ExecutionEventType.SESSION_STARTED in event_types
        assert ExecutionEventType.SESSION_COMPLETED in event_types

    @pytest.mark.asyncio
    async def test_run_tracks_progress(self):
        plan = _make_plan(required_count=3, optional_count=0, validation_count=0)
        rt = _make_runtime()
        session = rt.create_session(plan)
        result = await rt.run(session.id)
        assert result.metrics.tasks_succeeded + result.metrics.tasks_failed == 3

    @pytest.mark.asyncio
    async def test_run_registers_artifacts(self):
        plan = _make_plan(required_count=2, optional_count=0, validation_count=0)
        rt = _make_runtime()
        session = rt.create_session(plan)
        result = await rt.run(session.id)
        # Each mock executor produces 1 artifact per tool
        assert result.metrics.artifacts_registered == 2

    @pytest.mark.asyncio
    async def test_cancellation_stops_run(self):
        plan = _make_plan(required_count=5, optional_count=0, validation_count=0)
        rt = _make_runtime()

        # Install a slow mock executor so we can cancel mid-run
        class SlowMock(MockExecutor):
            def __init__(self):
                super().__init__(ToolCategory.FILESYSTEM, simulated_duration=0.2)

        rt.register_executor(SlowMock())
        session = rt.create_session(plan)

        async def cancel_soon():
            await asyncio.sleep(0.05)
            await rt.cancel(session.id, "Test cancellation")

        done, _ = await asyncio.gather(
            rt.run(session.id),
            cancel_soon(),
            return_exceptions=True,
        )
        # Session should end in COMPLETED (wrapping CANCELLED)
        s = rt.get_session(session.id)
        assert s.is_terminal

    @pytest.mark.asyncio
    async def test_already_terminal_run_returns_immediately(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        await rt.run(session.id)
        # Running again should return the completed session immediately
        result2 = await rt.run(session.id)
        assert result2.is_terminal

    @pytest.mark.asyncio
    async def test_pause_resume_cycle(self):
        plan = _make_plan(required_count=1, optional_count=0, validation_count=0)
        rt = _make_runtime()
        session = rt.create_session(plan)

        # Transition manually to test pause/resume API
        session.transition_to(ExecutionState.QUEUED)
        session.transition_to(ExecutionState.RUNNING)
        await rt.pause(session.id)
        assert session.state == ExecutionState.PAUSED
        await rt.resume(session.id)
        assert session.state == ExecutionState.RUNNING

    @pytest.mark.asyncio
    async def test_pause_non_running_raises(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        with pytest.raises(ValueError):
            await rt.pause(session.id)

    @pytest.mark.asyncio
    async def test_resume_non_paused_raises(self):
        plan = _make_plan()
        rt = _make_runtime()
        session = rt.create_session(plan)
        session.transition_to(ExecutionState.QUEUED)
        session.transition_to(ExecutionState.RUNNING)
        with pytest.raises(ValueError):
            await rt.resume(session.id)


# ---------------------------------------------------------------------------
# Retry Policy
# ---------------------------------------------------------------------------


class TestRetryPolicy:
    @pytest.mark.asyncio
    async def test_no_retry_on_success(self):
        plan = _make_plan(required_count=1, optional_count=0, validation_count=0)
        rt = _make_runtime()
        session = rt.create_session(plan, retry_policy=RetryPolicy(max_attempts=3))
        result = await rt.run(session.id)
        assert result.metrics.retry_count == 0

    @pytest.mark.asyncio
    async def test_failing_executor_triggers_retry(self):
        plan = _make_plan(required_count=1, optional_count=0, validation_count=0)
        rt = _make_runtime()

        # Install a mock that always fails
        always_fail = MockExecutor(
            ToolCategory.FILESYSTEM,
            success_rate=0.0,
            simulated_duration=0.01,
        )
        rt.register_executor(always_fail)

        policy = RetryPolicy(max_attempts=2, backoff_seconds=0.01, backoff_multiplier=1.0)
        session = rt.create_session(plan, retry_policy=policy)
        result = await rt.run(session.id)

        assert result.metrics.retry_count >= 1
        assert result.is_terminal


# ---------------------------------------------------------------------------
# Diagnostics API
# ---------------------------------------------------------------------------


class TestDiagnostics:
    @pytest.mark.asyncio
    async def test_get_metrics(self):
        plan = _make_plan(required_count=2, optional_count=0, validation_count=0)
        rt = _make_runtime()
        session = rt.create_session(plan)
        await rt.run(session.id)
        metrics = rt.get_metrics(session.id)
        assert "progress_percent" in metrics
        assert "total_tasks" in metrics

    @pytest.mark.asyncio
    async def test_get_events(self):
        plan = _make_plan(required_count=1, optional_count=0, validation_count=0)
        rt = _make_runtime()
        session = rt.create_session(plan)
        await rt.run(session.id)
        events = rt.get_events(session.id)
        assert isinstance(events, list)
        assert len(events) > 0

    @pytest.mark.asyncio
    async def test_get_artifacts(self):
        plan = _make_plan(required_count=2, optional_count=0, validation_count=0)
        rt = _make_runtime()
        session = rt.create_session(plan)
        await rt.run(session.id)
        artifacts = rt.get_artifacts(session.id)
        assert isinstance(artifacts, list)
        assert len(artifacts) == 2


# ---------------------------------------------------------------------------
# Integration: Tool Orchestrator -> Execution Runtime
# ---------------------------------------------------------------------------


class TestOrchestratorRuntimeIntegration:
    @pytest.mark.asyncio
    async def test_orchestrate_and_run(self):
        """Full pipeline: orchestrate a task then run it through the runtime."""
        from types import SimpleNamespace

        orch = ToolOrchestrator()
        task = SimpleNamespace(
            id="task-integration-01",
            name="Build and test the backend service",
            description="Compile, lint, and run unit tests.",
            phase="implementation",
            required_capabilities=["agent_runtime"],
            required_skills=["qa-test-automation"],
            required_tools=["python"],
            is_validation_checkpoint=True,
            is_reflection_checkpoint=False,
            estimated_complexity="medium",
            routing_decision=None,
        )

        plan = orch.orchestrate(task)
        assert len(plan.required_tools) > 0

        rt = _make_runtime()
        session = rt.create_session(plan)
        result = await rt.run(session.id)

        assert result.is_terminal
        assert result.metrics.total_tool_calls > 0

    @pytest.mark.asyncio
    async def test_kernel_integration_smoke(self):
        """ExecutionRuntime should initialize cleanly with a fake registry."""

        class _FakeCapRegistry:
            def register(self, cap):
                pass

        class _FakeRegistry:
            async def lookup(self, name):
                if name == "capability_registry":
                    return _FakeCapRegistry()
                raise KeyError(name)

        from prism.core.execution_runtime import ExecutionRuntime
        rt = ExecutionRuntime()
        await rt.initialize(_FakeRegistry())
        assert rt.metadata.status == "active"
        assert rt.metadata.health == "healthy"
