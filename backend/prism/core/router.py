"""PRISM Model Router Subsystem."""

import logging
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from prism.core.mind_registry import PrismSubsystem, SubsystemMetadata
from prism.core.capability import Capability, CapabilityMetadata

logger = logging.getLogger(__name__)

class ModelProfile(BaseModel):
    id: str
    name: str
    provider: str
    context_window: int
    supports_vision: bool = False
    supports_tools: bool = True
    reasoning_depth: str = "medium"  # low, medium, high
    coding_proficiency: str = "medium"  # low, medium, high
    cost_tier: str = "medium"  # low, medium, high
    latency_tier: str = "medium"  # low, medium, high
    is_local: bool = False

class ProviderProfile(BaseModel):
    id: str
    name: str
    is_local: bool = False
    priority: int = 10
    models: List[ModelProfile] = Field(default_factory=list)

class RouterPolicy(BaseModel):
    id: str
    name: str
    description: str
    prefer_local: bool = False
    max_cost_tier: str = "high"
    min_reasoning_depth: str = "low"
    require_vision: bool = False

class RoutingDecision(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    selected_model: str
    selected_provider: str
    fallback_chain: List[str] = Field(default_factory=list)  # model IDs
    confidence_score: float
    explanation: str
    policy_used: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class ModelRouter(PrismSubsystem):
    """Subsystem responsible for selecting the optimal model/provider for ExecutionTasks."""

    def __init__(self):
        super().__init__(SubsystemMetadata(
            name="model_router",
            version="1.0.0",
            description="Selects optimal models/providers for execution tasks without executing them.",
            dependencies=["configuration", "capability_registry"]
        ))
        self._providers: Dict[str, ProviderProfile] = {}
        self._load_builtin_profiles()

    def _load_builtin_profiles(self):
        # Register some built-in profiles for routing logic
        anthropic = ProviderProfile(
            id="anthropic",
            name="Anthropic",
            priority=1,
            models=[
                ModelProfile(id="claude-3-7-sonnet", name="Claude 3.7 Sonnet", provider="anthropic", context_window=200000, supports_vision=True, reasoning_depth="high", coding_proficiency="high", cost_tier="high", latency_tier="medium"),
                ModelProfile(id="claude-3-5-haiku", name="Claude 3.5 Haiku", provider="anthropic", context_window=200000, supports_vision=True, reasoning_depth="medium", coding_proficiency="medium", cost_tier="low", latency_tier="low")
            ]
        )
        openai = ProviderProfile(
            id="openai",
            name="OpenAI",
            priority=2,
            models=[
                ModelProfile(id="gpt-4o", name="GPT-4o", provider="openai", context_window=128000, supports_vision=True, reasoning_depth="high", coding_proficiency="high", cost_tier="high", latency_tier="medium"),
                ModelProfile(id="gpt-4o-mini", name="GPT-4o-mini", provider="openai", context_window=128000, supports_vision=True, reasoning_depth="low", coding_proficiency="medium", cost_tier="low", latency_tier="low"),
                ModelProfile(id="o1", name="o1", provider="openai", context_window=128000, supports_vision=True, reasoning_depth="high", coding_proficiency="high", cost_tier="high", latency_tier="high")
            ]
        )
        google = ProviderProfile(
            id="google",
            name="Google",
            priority=3,
            models=[
                ModelProfile(id="gemini-2.5-pro", name="Gemini 2.5 Pro", provider="google", context_window=2000000, supports_vision=True, reasoning_depth="high", coding_proficiency="high", cost_tier="high", latency_tier="medium"),
                ModelProfile(id="gemini-2.5-flash", name="Gemini 2.5 Flash", provider="google", context_window=1000000, supports_vision=True, reasoning_depth="medium", coding_proficiency="medium", cost_tier="low", latency_tier="low")
            ]
        )
        ollama = ProviderProfile(
            id="ollama",
            name="Ollama (Local)",
            is_local=True,
            priority=4,
            models=[
                ModelProfile(id="llama3.3", name="Llama 3.3 70B", provider="ollama", context_window=128000, supports_vision=False, reasoning_depth="high", coding_proficiency="medium", cost_tier="low", latency_tier="medium", is_local=True),
                ModelProfile(id="qwen2.5-coder", name="Qwen 2.5 Coder", provider="ollama", context_window=32000, supports_vision=False, reasoning_depth="medium", coding_proficiency="high", cost_tier="low", latency_tier="low", is_local=True)
            ]
        )
        for p in [anthropic, openai, google, ollama]:
            self._providers[p.id] = p

    async def initialize(self, registry: Any) -> None:
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"

        try:
            cap_registry = await registry.lookup("capability_registry")
            cap_registry.register(Capability(CapabilityMetadata(
                id="model_router",
                name="Model Router",
                version="1.0.0",
                description="Selects optimal models/providers for tasks based on complexity, capabilities, and constraints."
            )))
        except Exception as e:
            logger.warning(f"Could not register model_router capability: {e}")

        self.metadata.status = "active"
        self.metadata.health = "healthy"
        logger.info("Model Router initialized.")

    def route_task(self, task: Any, strategy: Any = None, context: Any = None) -> RoutingDecision:
        """Evaluate an ExecutionTask and return a RoutingDecision."""
        
        # Derive policy from strategy if provided
        prefer_local = strategy.prefer_local if strategy and hasattr(strategy, "prefer_local") else False
        policy = RouterPolicy(
            id="dynamic_policy",
            name="Dynamic Policy",
            description="Policy derived from strategy and task context",
            prefer_local=prefer_local
        )

        requires_vision = "vision" in task.required_capabilities or "vision" in task.required_skills
        requires_coding = any(skill for skill in task.required_skills if "engineer" in skill.lower() or "coding" in skill.lower() or "development" in skill.lower())
        
        complexity = task.estimated_complexity

        # Flatten all available models
        all_models: List[ModelProfile] = []
        for provider in self._providers.values():
            all_models.extend(provider.models)

        # Score models
        scored_models = []
        for model in all_models:
            score = 100.0
            
            if requires_vision and not model.supports_vision:
                continue
                
            if policy.prefer_local and not model.is_local:
                score -= 40
            elif not policy.prefer_local and model.is_local:
                score -= 10
                
            if complexity == "high" and model.reasoning_depth != "high":
                score -= 30
            elif complexity == "low" and model.reasoning_depth == "high":
                # Overkill is slightly penalized to save cost
                score -= 10
                
            if requires_coding and model.coding_proficiency != "high":
                score -= 25
                
            if model.cost_tier == "high" and complexity == "low":
                score -= 15
                
            # Apply provider priority (lower is better, so subtract)
            provider_priority = self._providers[model.provider].priority
            score -= (provider_priority * 2)

            scored_models.append((score, model))

        scored_models.sort(key=lambda x: x[0], reverse=True)

        if not scored_models:
            # Fallback to a default if nothing matches perfectly
            best_model = self._providers["anthropic"].models[0]
            fallback_chain = []
            confidence = 0.5
            explanation = "No perfect match found, falling back to default highly capable model."
        else:
            best_model = scored_models[0][1]
            fallback_chain = [m.id for _, m in scored_models[1:4]]
            confidence = min(0.99, scored_models[0][0] / 100.0)
            explanation = f"Selected {best_model.name} based on complexity ({complexity}), coding requirements ({requires_coding}), and local preference ({policy.prefer_local})."

        decision = RoutingDecision(
            task_id=task.id,
            selected_model=best_model.id,
            selected_provider=best_model.provider,
            fallback_chain=fallback_chain,
            confidence_score=confidence,
            explanation=explanation,
            policy_used=policy.name
        )
        
        logger.debug(f"Routed task {task.id} to {best_model.id} (score: {confidence})")
        return decision

model_router = ModelRouter()
