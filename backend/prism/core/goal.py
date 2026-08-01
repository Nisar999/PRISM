"""PRISM Goal Registry Subsystem."""

import logging
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from prism.core.mind_registry import PrismSubsystem, SubsystemMetadata
from prism.core.capability import Capability, CapabilityMetadata

logger = logging.getLogger(__name__)

from prism.core.strategy import Strategy

class GoalTemplate(BaseModel):
    id: str
    category: str
    description: str
    required_phases: List[str] = Field(default_factory=list)
    recommended_capabilities: List[str] = Field(default_factory=list)
    recommended_skills: List[str] = Field(default_factory=list)
    recommended_tools: List[str] = Field(default_factory=list)
    validation_checkpoints: List[str] = Field(default_factory=list)
    expected_deliverables: List[str] = Field(default_factory=list)

class Goal(BaseModel):
    id: str
    template_id: str
    primary_objective: str
    phases: List[str] = Field(default_factory=list)
    capabilities: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    checkpoints: List[str] = Field(default_factory=list)
    deliverables: List[str] = Field(default_factory=list)
    strategy: Optional[Strategy] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class GoalRegistry(PrismSubsystem):
    """Subsystem responsible for registering and exposing reusable goal templates."""

    def __init__(self):
        super().__init__(SubsystemMetadata(
            name="goal_registry",
            version="1.0.0",
            description="Manages reusable goal templates and blueprints.",
            dependencies=["configuration"]
        ))
        self._templates: Dict[str, GoalTemplate] = {}
        self._registry = None

    async def initialize(self, registry: Any) -> None:
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"
        self._registry = registry
        
        self._register_default_templates()

        # Register as capability if CapabilityRegistry exists
        try:
            cap_registry = await registry.lookup("capability_registry")
            cap_registry.register(Capability(CapabilityMetadata(
                id="goal_registry",
                name="Goal Registry",
                version="1.0.0",
                description="Converts intent categories into execution blueprints."
            )))
        except Exception as e:
            logger.warning(f"Could not register goal_registry capability: {e}")

        self.metadata.status = "active"
        self.metadata.health = "healthy"
        logger.info(f"Goal Registry initialized with {len(self._templates)} templates.")

    def register_template(self, template: GoalTemplate) -> None:
        self._templates[template.id] = template
        logger.info(f"Registered Goal Template: {template.id}")

    def get_template(self, template_id: str) -> GoalTemplate:
        # Match normal form
        normal_id = template_id.lower().replace(" ", "_")
        if normal_id in self._templates:
            return self._templates[normal_id]
        if template_id in self._templates:
            return self._templates[template_id]
        raise KeyError(f"Goal Template '{template_id}' not found.")

    def get_templates(self) -> Dict[str, GoalTemplate]:
        return self._templates

    async def resolve_goal(self, category: str, objective: str, custom_metadata: Dict[str, Any] = None) -> Goal:
        """Resolve a structured Goal from an Intent category and objective."""
        template = self.get_template(category)
        goal_id = str(uuid.uuid4())
        
        # Resolve strategy dynamically
        strategy = None
        try:
            profile_map = {
                "feature development": "coding",
                "refactoring": "coding",
                "debugging": "deep",
                "architecture": "balanced",
                "research": "research",
                "documentation": "fast",
                "memory operation": "offline",
                "system management": "balanced"
            }
            profile_id = profile_map.get(template.category.lower(), "balanced")
            if self._registry:
                strategy_engine = await self._registry.lookup("strategy_engine")
                strategy = strategy_engine.resolve_strategy(profile_id, objective, custom_metadata)
        except Exception as e:
            logger.warning(f"Failed to lookup strategy: {e}")

        return Goal(
            id=goal_id,
            template_id=template.id,
            primary_objective=objective,
            phases=template.required_phases,
            capabilities=template.recommended_capabilities,
            skills=template.recommended_skills,
            tools=template.recommended_tools,
            checkpoints=template.validation_checkpoints,
            deliverables=template.expected_deliverables,
            strategy=strategy,
            metadata=custom_metadata or {}
        )

    def _register_default_templates(self) -> None:
        # 1. Feature Development
        self.register_template(GoalTemplate(
            id="feature_development",
            category="feature development",
            description="Blueprint for creating new system features and capabilities.",
            required_phases=["Requirements gathering", "Design", "Implementation", "Verification"],
            recommended_capabilities=["tool_runtime", "capability_registry"],
            recommended_skills=["backend-engineer", "frontend-engineer"],
            recommended_tools=["write_to_file", "replace_file_content"],
            validation_checkpoints=["Linter passing", "Unit tests passing", "No circular dependencies"],
            expected_deliverables=["Clean source code", "Walkthrough.md", "Unit tests"]
        ))
        
        # 2. Debugging
        self.register_template(GoalTemplate(
            id="debugging",
            category="debugging",
            description="Blueprint for identifying and resolving bugs or defects.",
            required_phases=["Reproduction", "Root cause analysis", "Fix implementation", "Regression testing"],
            recommended_capabilities=["reflection_engine", "healing_engine"],
            recommended_skills=["qa-test-automation", "backend-engineer"],
            recommended_tools=["run_command", "view_file"],
            validation_checkpoints=["Bug no longer reproducible", "Existing tests pass"],
            expected_deliverables=["Bug fix patch", "Regression test case"]
        ))

        # 3. Refactoring
        self.register_template(GoalTemplate(
            id="refactoring",
            category="refactoring",
            description="Blueprint for restructuring existing code without changing behavior.",
            required_phases=["Pre-verify", "Code restructuring", "Post-verify"],
            recommended_capabilities=["tool_runtime"],
            recommended_skills=["backend-engineer"],
            recommended_tools=["replace_file_content", "multi_replace_file_content"],
            validation_checkpoints=["No functional changes", "Linter clean", "Complexity score reduced"],
            expected_deliverables=["Refactored source files", "Verification report"]
        ))

        # 4. Documentation
        self.register_template(GoalTemplate(
            id="documentation",
            category="documentation",
            description="Blueprint for writing code documentation, READMEs, and specs.",
            required_phases=["Outline", "Drafting", "Peer review"],
            recommended_capabilities=["visualization"],
            recommended_skills=["technical-writing"],
            recommended_tools=["write_to_file"],
            validation_checkpoints=["Links verified", "Spelling check passed"],
            expected_deliverables=["Updated Markdown documentation"]
        ))

        # 5. Research
        self.register_template(GoalTemplate(
            id="research",
            category="research",
            description="Blueprint for studying codebases, APIs, and domain topics.",
            required_phases=["Search", "Information aggregation", "Summary report"],
            recommended_capabilities=["provider_layer"],
            recommended_skills=["product-manager"],
            recommended_tools=["grep_search", "view_file"],
            validation_checkpoints=["Source references listed"],
            expected_deliverables=["Research notes or ADR draft"]
        ))

        # 6. Architecture
        self.register_template(GoalTemplate(
            id="architecture",
            category="architecture",
            description="Blueprint for drafting high-level systems design and design patterns.",
            required_phases=["Domain modeling", "Component design", "ADR drafting"],
            recommended_capabilities=["planning_engine"],
            recommended_skills=["system-design-architecture", "cloud-architecture"],
            recommended_tools=["write_to_file"],
            validation_checkpoints=["Approved component decoupling model"],
            expected_deliverables=["Architecture specifications", "ADR document"]
        ))

        # 7. Memory Operations
        self.register_template(GoalTemplate(
            id="memory_operation",
            category="memory operation",
            description="Blueprint for saving, cleaning, or retrieving cognitive memories.",
            required_phases=["Memory fetch", "Validation/cleaning", "Database write"],
            recommended_capabilities=["memory_engine"],
            recommended_skills=["database-engineering"],
            recommended_tools=["run_command"],
            validation_checkpoints=["PII masked", "MemScore correctly computed"],
            expected_deliverables=["Relational/graph db update confirmation"]
        ))

        # 8. System Management
        self.register_template(GoalTemplate(
            id="system_management",
            category="system management",
            description="Blueprint for container deployment, pipelines, and performance observation.",
            required_phases=["Environment checks", "Deployment script execution", "Health audit"],
            recommended_capabilities=["resource_manager"],
            recommended_skills=["devops", "site-reliability-engineering"],
            recommended_tools=["run_command"],
            validation_checkpoints=["Container health check endpoints returning 200"],
            expected_deliverables=["Active environment config", "Observability metrics logs"]
        ))

goal_registry = GoalRegistry()
