"""Unit tests for the PRISM Tool Orchestrator subsystem."""

import pytest
from types import SimpleNamespace
from prism.core.tool_orchestrator import (
    ToolCategory,
    ToolPriority,
    ToolProfile,
    ToolExecutionPlan,
    ToolOrchestrator,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_task(
    *,
    task_id: str = "task-001",
    name: str = "Test Task",
    description: str = "A basic test task.",
    phase: str = "implementation",
    required_capabilities=None,
    required_skills=None,
    required_tools=None,
    is_validation_checkpoint: bool = False,
    is_reflection_checkpoint: bool = False,
    estimated_complexity: str = "medium",
    routing_decision=None,
):
    return SimpleNamespace(
        id=task_id,
        name=name,
        description=description,
        phase=phase,
        required_capabilities=required_capabilities or [],
        required_skills=required_skills or [],
        required_tools=required_tools or [],
        is_validation_checkpoint=is_validation_checkpoint,
        is_reflection_checkpoint=is_reflection_checkpoint,
        estimated_complexity=estimated_complexity,
        routing_decision=routing_decision,
    )


def _make_orchestrator() -> ToolOrchestrator:
    """Return a fresh (un-initialized) orchestrator instance for testing."""
    return ToolOrchestrator()


# ---------------------------------------------------------------------------
# Profile catalogue
# ---------------------------------------------------------------------------


class TestBuiltinProfiles:
    def test_builtin_profiles_loaded(self):
        orch = _make_orchestrator()
        profiles = orch.get_profiles()
        assert len(profiles) >= 18, "Expected at least 18 built-in profiles."

    def test_all_categories_covered(self):
        orch = _make_orchestrator()
        profiles = orch.get_profiles()
        categories_present = {p["category"] for p in profiles.values()}
        required_categories = {c.value for c in ToolCategory}
        assert required_categories.issubset(categories_present)

    def test_register_custom_profile(self):
        orch = _make_orchestrator()
        custom = ToolProfile(
            id="custom_tool",
            name="Custom Tool",
            category=ToolCategory.LOCAL_SCRIPT,
            description="A custom tool for testing.",
            trigger_keywords=["custom"],
        )
        orch.register_profile(custom)
        assert "custom_tool" in orch.get_profiles()

    def test_register_profile_overwrites(self):
        orch = _make_orchestrator()
        updated = ToolProfile(
            id="fs_read",
            name="Filesystem Read - Updated",
            category=ToolCategory.FILESYSTEM,
            description="Updated description.",
        )
        orch.register_profile(updated)
        assert orch.get_profiles()["fs_read"]["name"] == "Filesystem Read - Updated"


# ---------------------------------------------------------------------------
# Tool selection
# ---------------------------------------------------------------------------


class TestToolSelection:
    def test_empty_task_returns_empty_plan(self):
        orch = _make_orchestrator()
        task = _make_task()
        plan = orch.orchestrate(task)
        assert isinstance(plan, ToolExecutionPlan)
        assert plan.task_id == task.id
        assert len(plan.required_tools) == 0

    def test_capability_match_selects_tools(self):
        orch = _make_orchestrator()
        task = _make_task(required_capabilities=["memory"])
        plan = orch.orchestrate(task)
        tool_ids = {r.tool_id for r in plan.required_tools}
        assert any(
            tid in tool_ids for tid in ["db_query", "vector_search", "db_write", "vector_upsert"]
        )

    def test_skill_match_selects_optional_tools(self):
        orch = _make_orchestrator()
        task = _make_task(required_skills=["devops"])
        plan = orch.orchestrate(task)
        optional_ids = {r.tool_id for r in plan.optional_tools}
        assert any(
            tid in optional_ids for tid in ["terminal_exec", "git_write", "docker_exec", "local_script"]
        )

    def test_explicit_hint_selects_critical_tool(self):
        orch = _make_orchestrator()
        task = _make_task(required_tools=["python"])
        plan = orch.orchestrate(task)
        critical_ids = {
            r.tool_id for r in plan.required_tools if r.priority == ToolPriority.CRITICAL
        }
        assert "python_exec" in critical_ids

    def test_keyword_match_selects_optional_tool(self):
        orch = _make_orchestrator()
        task = _make_task(name="Deploy docker container")
        plan = orch.orchestrate(task)
        all_ids = {r.tool_id for r in plan.required_tools + plan.optional_tools}
        assert any("docker" in tid for tid in all_ids)

    def test_validation_checkpoint_adds_validation_tools(self):
        orch = _make_orchestrator()
        task = _make_task(
            name="Verify Phase",
            required_capabilities=["reflection"],
            required_skills=["qa-test-automation"],
            is_validation_checkpoint=True,
        )
        plan = orch.orchestrate(task)
        val_ids = {r.tool_id for r in plan.validation_tools}
        assert "python_exec" in val_ids
        assert "python_lint" in val_ids
        assert "terminal_exec" in val_ids

    def test_reflection_checkpoint_adds_optional_tools(self):
        orch = _make_orchestrator()
        task = _make_task(
            name="Reflect Phase",
            is_reflection_checkpoint=True,
        )
        plan = orch.orchestrate(task)
        optional_ids = {r.tool_id for r in plan.optional_tools}
        assert "git_read" in optional_ids
        assert "db_query" in optional_ids

    def test_no_duplicate_tools(self):
        orch = _make_orchestrator()
        task = _make_task(
            required_capabilities=["memory"],
            required_skills=["database-engineering"],
            required_tools=["db_query"],
        )
        plan = orch.orchestrate(task)
        # Each individual bucket must not have duplicate tool IDs
        for bucket, name in [
            (plan.required_tools, "required"),
            (plan.optional_tools, "optional"),
            (plan.validation_tools, "validation"),
        ]:
            tool_ids = [r.tool_id for r in bucket]
            assert len(tool_ids) == len(set(tool_ids)), f"Duplicate tool IDs found in {name} bucket."


    def test_fs_read_added_when_task_has_work(self):
        orch = _make_orchestrator()
        task = _make_task(required_capabilities=["agent_runtime"])
        plan = orch.orchestrate(task)
        req_ids = {r.tool_id for r in plan.required_tools}
        assert "fs_read" in req_ids


# ---------------------------------------------------------------------------
# Execution order and dependency graph
# ---------------------------------------------------------------------------


class TestExecutionOrder:
    def test_required_tools_in_first_group(self):
        orch = _make_orchestrator()
        task = _make_task(required_capabilities=["memory"])
        plan = orch.orchestrate(task)
        if plan.required_tools and plan.execution_order:
            group_0_ids = set(plan.execution_order[0])
            required_ids = {r.id for r in plan.required_tools}
            assert required_ids == group_0_ids

    def test_validation_tools_in_last_group(self):
        orch = _make_orchestrator()
        task = _make_task(
            required_capabilities=["agent_runtime"],
            is_validation_checkpoint=True,
        )
        plan = orch.orchestrate(task)
        if plan.validation_tools and plan.execution_order:
            last_group = set(plan.execution_order[-1])
            val_ids = {r.id for r in plan.validation_tools}
            assert val_ids.issubset(last_group)

    def test_execution_order_covers_all_tools(self):
        orch = _make_orchestrator()
        task = _make_task(
            required_capabilities=["memory"],
            required_skills=["devops"],
            is_validation_checkpoint=True,
        )
        plan = orch.orchestrate(task)
        all_ordered = {rid for group in plan.execution_order for rid in group}
        all_reqs = {
            r.id
            for r in plan.required_tools + plan.optional_tools + plan.validation_tools
        }
        assert all_ordered == all_reqs


class TestDependencyGraph:
    def test_dependency_graph_keys_match_all_reqs(self):
        orch = _make_orchestrator()
        task = _make_task(
            required_capabilities=["memory"],
            required_skills=["devops"],
        )
        plan = orch.orchestrate(task)
        all_req_ids = {
            r.id
            for r in plan.required_tools + plan.optional_tools + plan.validation_tools
        }
        assert set(plan.dependency_graph.keys()) == all_req_ids

    def test_required_tools_have_sequential_deps(self):
        orch = _make_orchestrator()
        task = _make_task(required_capabilities=["memory"])
        plan = orch.orchestrate(task)
        for i in range(1, len(plan.required_tools)):
            prev_id = plan.required_tools[i - 1].id
            curr = plan.required_tools[i]
            assert prev_id in curr.depends_on


# ---------------------------------------------------------------------------
# Runtime estimation
# ---------------------------------------------------------------------------


class TestRuntimeEstimation:
    def test_sequential_runtime_is_sum_of_required_and_validation(self):
        orch = _make_orchestrator()
        task = _make_task(
            required_capabilities=["memory"],
            is_validation_checkpoint=True,
        )
        plan = orch.orchestrate(task)
        expected = sum(
            r.estimated_duration_seconds
            for r in plan.required_tools + plan.validation_tools
        )
        assert plan.estimated_runtime_seconds == expected

    def test_parallel_runtime_is_non_negative(self):
        orch = _make_orchestrator()
        task = _make_task(
            required_capabilities=["memory"],
            required_skills=["devops"],
            is_validation_checkpoint=True,
        )
        plan = orch.orchestrate(task)
        assert plan.estimated_parallel_runtime_seconds >= 0


# ---------------------------------------------------------------------------
# orchestrate_plan convenience method
# ---------------------------------------------------------------------------


class TestOrchestratePlan:
    def test_orchestrate_plan_returns_one_plan_per_task(self):
        orch = _make_orchestrator()
        task1 = _make_task(task_id="t1", required_capabilities=["memory"])
        task2 = _make_task(task_id="t2", required_skills=["devops"])
        stage = SimpleNamespace(tasks=[task1, task2])
        execution_plan = SimpleNamespace(id="plan-abc", stages=[stage])

        plans = orch.orchestrate_plan(execution_plan)
        assert len(plans) == 2
        assert plans[0].task_id == "t1"
        assert plans[1].task_id == "t2"

    def test_orchestrate_plan_uses_task_routing_decision(self):
        orch = _make_orchestrator()
        routing = SimpleNamespace(id="rd-001")
        task = _make_task(task_id="t1", required_capabilities=["agent_runtime"])
        task.routing_decision = routing
        stage = SimpleNamespace(tasks=[task])
        execution_plan = SimpleNamespace(id="plan-xyz", stages=[stage])

        plans = orch.orchestrate_plan(execution_plan)
        assert plans[0].routing_decision_id == "rd-001"


# ---------------------------------------------------------------------------
# Kernel integration (smoke test — no actual boot required)
# ---------------------------------------------------------------------------


class TestKernelIntegration:
    @pytest.mark.asyncio
    async def test_tool_orchestrator_initializes_standalone(self):
        """ToolOrchestrator should initialize cleanly without a real registry."""

        class _FakeCapRegistry:
            def register(self, cap):  # noqa: D102
                pass

        class _FakeRegistry:
            async def lookup(self, name):  # noqa: D102
                return _FakeCapRegistry()

        orch = ToolOrchestrator()
        await orch.initialize(_FakeRegistry())
        assert orch.metadata.status == "active"
        assert orch.metadata.health == "healthy"
        assert len(orch.get_profiles()) >= 18
