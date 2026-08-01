"""PRISM Cognitive Planner Subsystem."""

import logging
import uuid
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field
from prism.core.mind_registry import PrismSubsystem, SubsystemMetadata
from prism.core.capability import Capability, CapabilityMetadata

logger = logging.getLogger(__name__)


class ExecutionTask(BaseModel):
    id: str
    name: str
    description: str
    phase: str
    required_capabilities: List[str] = Field(default_factory=list)
    required_skills: List[str] = Field(default_factory=list)
    required_tools: List[str] = Field(default_factory=list)
    dependencies: List[str] = Field(default_factory=list)  # task IDs
    parallelizable: bool = False
    is_validation_checkpoint: bool = False
    is_reflection_checkpoint: bool = False
    estimated_complexity: str = "low"  # low, medium, high
    routing_decision: Optional[Any] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ExecutionStage(BaseModel):
    id: str
    name: str
    description: str
    phase_index: int
    tasks: List[ExecutionTask] = Field(default_factory=list)
    parallel_groups: List[List[str]] = Field(default_factory=list)  # Groups of parallel task IDs
    validation_checkpoint: bool = False
    reflection_checkpoint: bool = False


class ExecutionPlan(BaseModel):
    id: str
    goal_id: str
    strategy_profile: str
    primary_objective: str
    stages: List[ExecutionStage] = Field(default_factory=list)
    total_tasks: int = 0
    estimated_complexity: str = "medium"
    parallelizable_stages: List[str] = Field(default_factory=list)
    knowledge_context: List[str] = Field(default_factory=list)  # Relevant KnowledgeNode IDs
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CognitivePlanner(PrismSubsystem):
    """Subsystem responsible for converting resolved Goals and Strategies into ExecutionPlans."""

    def __init__(self):
        super().__init__(SubsystemMetadata(
            name="cognitive_planner",
            version="1.0.0",
            description="Converts Intent+Goal+Strategy+Knowledge into structured ExecutionPlans.",
            dependencies=["configuration", "goal_registry", "strategy_engine", "knowledge_graph"]
        ))
        self._registry = None

    async def initialize(self, registry: Any) -> None:
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"
        self._registry = registry

        try:
            cap_registry = await registry.lookup("capability_registry")
            cap_registry.register(Capability(CapabilityMetadata(
                id="cognitive_planner",
                name="Cognitive Planner",
                version="1.0.0",
                description="Generates structured ExecutionPlans from Goals and Strategies."
            )))
        except Exception as e:
            logger.warning(f"Could not register cognitive_planner capability: {e}")

        self.metadata.status = "active"
        self.metadata.health = "healthy"
        logger.info("Cognitive Planner initialized.")

    async def plan(self, intent: Any) -> ExecutionPlan:
        """Generate an ExecutionPlan from a resolved Intent (with Goal and Strategy attached)."""
        if not intent.resolved_goal:
            raise ValueError("Intent must have a resolved Goal before planning.")

        goal = intent.resolved_goal
        strategy = goal.strategy
        strategy_profile = strategy.profile_id if strategy else "balanced"
        plan_id = str(uuid.uuid4())

        # Capture live context snapshot
        context_snapshot: Optional[Dict[str, Any]] = None
        try:
            ctx_engine = await self._registry.lookup("context_engine")
            context_snapshot = ctx_engine.serialize()
        except Exception as e:
            logger.debug(f"Context snapshot unavailable: {e}")

        # Gather relevant knowledge context
        knowledge_ctx: Set[str] = set()
        try:
            kg = await self._registry.lookup("knowledge_graph")
            # Traverse the knowledge graph to find relevant nodes given goal capabilities
            for cap in goal.capabilities:
                matched = kg.search_by_type(cap)
                for node in matched:
                    traversed = kg.traverse(node.id, max_depth=1)
                    knowledge_ctx.update(traversed)
        except Exception as e:
            logger.debug(f"Knowledge context enrichment skipped: {e}")

        # Build stages from Goal phases
        stages: List[ExecutionStage] = []
        all_tasks: List[ExecutionTask] = []

        for phase_idx, phase_name in enumerate(goal.phases):
            tasks = self._decompose_phase(
                phase_name=phase_name,
                phase_idx=phase_idx,
                goal=goal,
                strategy=strategy
            )
            all_tasks.extend(tasks)

            # Determine parallelizable groups and validation/reflection checkpoints
            parallel_groups = self._identify_parallel_groups(tasks, strategy)
            is_validation_cp = self._is_validation_checkpoint(phase_name, strategy)
            is_reflection_cp = self._is_reflection_checkpoint(phase_name, phase_idx, strategy)

            stage = ExecutionStage(
                id=str(uuid.uuid4()),
                name=phase_name,
                description=f"Stage for phase: {phase_name}",
                phase_index=phase_idx,
                tasks=tasks,
                parallel_groups=parallel_groups,
                validation_checkpoint=is_validation_cp,
                reflection_checkpoint=is_reflection_cp
            )
            stages.append(stage)

        # Apply routing to all tasks
        try:
            router = await self._registry.lookup("model_router")
            for t in all_tasks:
                t.routing_decision = router.route_task(t, strategy)
        except Exception as e:
            logger.debug(f"Model router unavailable: {e}")

        parallelizable_stage_ids = [
            s.id for s in stages
            if any(len(group) > 1 for group in s.parallel_groups)
        ]

        overall_complexity = self._estimate_overall_complexity(intent, goal, stages)

        plan = ExecutionPlan(
            id=plan_id,
            goal_id=goal.id,
            strategy_profile=strategy_profile,
            primary_objective=goal.primary_objective,
            stages=stages,
            total_tasks=len(all_tasks),
            estimated_complexity=overall_complexity,
            parallelizable_stages=parallelizable_stage_ids,
            knowledge_context=list(knowledge_ctx),
            metadata={
                "intent_category": intent.category,
                "raw_request": intent.raw_request[:100],
                "context_snapshot": context_snapshot
            }
        )

        # Notify context_engine of the generated plan
        try:
            ctx_engine = await self._registry.lookup("context_engine")
            ctx_engine.attach_plan(plan.id)
        except Exception:
            pass

        logger.info(
            f"ExecutionPlan generated: {plan.id} | "
            f"Stages={len(stages)}, Tasks={plan.total_tasks}, "
            f"Complexity={overall_complexity}"
        )
        return plan

    def _decompose_phase(
        self,
        phase_name: str,
        phase_idx: int,
        goal: Any,
        strategy: Any
    ) -> List[ExecutionTask]:
        """Decompose a phase name into concrete tasks based on Goal context."""
        tasks = []
        phase_lower = phase_name.lower()
        base_capabilities = goal.capabilities
        base_skills = goal.skills
        base_tools = goal.tools

        # Core task always present
        core_task = ExecutionTask(
            id=str(uuid.uuid4()),
            name=f"{phase_name}",
            description=f"Execute primary work for phase: {phase_name}",
            phase=phase_name,
            required_capabilities=base_capabilities[:2] if base_capabilities else [],
            required_skills=base_skills[:2] if base_skills else [],
            required_tools=base_tools[:2] if base_tools else [],
            dependencies=[],
            parallelizable=False,
            estimated_complexity="medium"
        )
        tasks.append(core_task)

        # Add validation sub-task for verification/testing phases
        if any(x in phase_lower for x in ["verif", "test", "check", "validation", "post-verif", "regression"]):
            validation_task = ExecutionTask(
                id=str(uuid.uuid4()),
                name=f"Validate: {phase_name}",
                description=f"Run automated checks and validation for {phase_name}.",
                phase=phase_name,
                required_capabilities=["reflection"],
                required_skills=["qa-test-automation"],
                required_tools=["run_command"],
                dependencies=[core_task.id],
                parallelizable=False,
                is_validation_checkpoint=True,
                estimated_complexity="low"
            )
            tasks.append(validation_task)

        # Add reflection sub-task based on strategy cadence
        if strategy and strategy.reflection_cadence == "per_step":
            reflection_task = ExecutionTask(
                id=str(uuid.uuid4()),
                name=f"Reflect: {phase_name}",
                description=f"Audit execution and check for contradictions or drift in phase: {phase_name}.",
                phase=phase_name,
                required_capabilities=["reflection"],
                required_skills=["qa-test-automation"],
                required_tools=[],
                dependencies=[core_task.id],
                parallelizable=False,
                is_reflection_checkpoint=True,
                estimated_complexity="low"
            )
            tasks.append(reflection_task)

        return tasks

    def _identify_parallel_groups(
        self,
        tasks: List[ExecutionTask],
        strategy: Any
    ) -> List[List[str]]:
        """Group tasks that can run in parallel when the strategy supports it."""
        if strategy and strategy.parallelization_policy == "sequential":
            return [[t.id] for t in tasks]

        independent_tasks = [t.id for t in tasks if not t.dependencies]
        dependent_tasks = [t.id for t in tasks if t.dependencies]

        groups = []
        if independent_tasks:
            if strategy and strategy.parallelization_policy == "parallel":
                groups.append(independent_tasks)
            else:
                # Dynamic: group non-validation and non-reflection tasks together
                core = [t for t in tasks if t.id in independent_tasks and not t.is_validation_checkpoint and not t.is_reflection_checkpoint]
                cp_and_reflect = [t for t in tasks if t.id in independent_tasks and (t.is_validation_checkpoint or t.is_reflection_checkpoint)]
                if core:
                    groups.append([t.id for t in core])
                if cp_and_reflect:
                    groups.append([t.id for t in cp_and_reflect])

        for task_id in dependent_tasks:
            groups.append([task_id])

        return groups

    def _is_validation_checkpoint(self, phase_name: str, strategy: Any) -> bool:
        if not strategy:
            return False
        keywords = ["verif", "test", "check", "review", "audit", "regression", "post-verif"]
        if any(k in phase_name.lower() for k in keywords):
            return True
        if strategy.validation_frequency == "high":
            return True
        return False

    def _is_reflection_checkpoint(self, phase_name: str, phase_idx: int, strategy: Any) -> bool:
        if not strategy:
            return False
        if strategy.reflection_cadence == "per_step":
            return True
        if strategy.reflection_cadence == "per_phase":
            return True
        return False

    def _estimate_overall_complexity(self, intent: Any, goal: Any, stages: List[ExecutionStage]) -> str:
        task_count = sum(len(s.tasks) for s in stages)
        base_complexity = intent.estimated_complexity
        if task_count > 15:
            return "high"
        if task_count > 6 or base_complexity == "high":
            return "medium" if base_complexity != "high" else "high"
        return base_complexity


cognitive_planner = CognitivePlanner()
