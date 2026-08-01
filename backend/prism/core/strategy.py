"""PRISM Strategy Engine Subsystem."""

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from prism.core.mind_registry import PrismSubsystem, SubsystemMetadata
from prism.core.capability import Capability, CapabilityMetadata

logger = logging.getLogger(__name__)

class StrategyProfile(BaseModel):
    id: str
    name: str
    execution_philosophy: str
    preferred_provider_types: List[str] = Field(default_factory=list)
    local_cloud_preference: str  # local_only, cloud_only, hybrid
    parallelization_policy: str  # sequential, parallel, dynamic
    validation_frequency: str  # high, medium, low
    reflection_cadence: str  # per_step, per_phase, deferred
    memory_usage_policy: str  # short_term, long_term, full_strata
    resource_awareness: str  # high, low, none
    cost_awareness: str  # high, low, none

class Strategy(BaseModel):
    profile_id: str
    execution_philosophy: str
    preferred_provider_types: List[str] = Field(default_factory=list)
    local_cloud_preference: str
    parallelization_policy: str
    validation_frequency: str
    reflection_cadence: str
    memory_usage_policy: str
    resource_awareness: str
    cost_awareness: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class StrategyEngine(PrismSubsystem):
    """Subsystem responsible for determining the optimal execution approach for a resolved Goal."""

    def __init__(self):
        super().__init__(SubsystemMetadata(
            name="strategy_engine",
            version="1.0.0",
            description="Resolves optimal execution strategies and profiles.",
            dependencies=["configuration"]
        ))
        self._profiles: Dict[str, StrategyProfile] = {}

    async def initialize(self, registry: Any) -> None:
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"
        
        self._register_default_profiles()

        # Register as a capability in CapabilityRegistry if available
        try:
            cap_registry = await registry.lookup("capability_registry")
            cap_registry.register(Capability(CapabilityMetadata(
                id="strategy_engine",
                name="Strategy Engine",
                version="1.0.0",
                description="Resolves goal execution strategies."
            )))
        except Exception as e:
            logger.warning(f"Could not register strategy_engine capability: {e}")

        self.metadata.status = "active"
        self.metadata.health = "healthy"
        logger.info(f"Strategy Engine initialized with {len(self._profiles)} profiles.")

    def register_profile(self, profile: StrategyProfile) -> None:
        self._profiles[profile.id] = profile
        logger.info(f"Registered Strategy Profile: {profile.id}")

    def get_profile(self, profile_id: str) -> StrategyProfile:
        normal_id = profile_id.lower().replace(" ", "_")
        if normal_id in self._profiles:
            return self._profiles[normal_id]
        if profile_id in self._profiles:
            return self._profiles[profile_id]
        raise KeyError(f"Strategy Profile '{profile_id}' not found.")

    def get_profiles(self) -> Dict[str, StrategyProfile]:
        return self._profiles

    def resolve_strategy(self, profile_id: str, objective: str, custom_metadata: Dict[str, Any] = None) -> Strategy:
        """Resolve a structured Strategy from a profile ID and user objective."""
        profile = self.get_profile(profile_id)
        
        return Strategy(
            profile_id=profile.id,
            execution_philosophy=profile.execution_philosophy,
            preferred_provider_types=profile.preferred_provider_types,
            local_cloud_preference=profile.local_cloud_preference,
            parallelization_policy=profile.parallelization_policy,
            validation_frequency=profile.validation_frequency,
            reflection_cadence=profile.reflection_cadence,
            memory_usage_policy=profile.memory_usage_policy,
            resource_awareness=profile.resource_awareness,
            cost_awareness=profile.cost_awareness,
            metadata=custom_metadata or {}
        )

    def _register_default_profiles(self) -> None:
        # 1. Balanced
        self.register_profile(StrategyProfile(
            id="balanced",
            name="Balanced",
            execution_philosophy="Optimizes for a balance of speed, cost, and reliability.",
            preferred_provider_types=["litellm", "ollama"],
            local_cloud_preference="hybrid",
            parallelization_policy="dynamic",
            validation_frequency="medium",
            reflection_cadence="per_phase",
            memory_usage_policy="long_term",
            resource_awareness="high",
            cost_awareness="high"
        ))

        # 2. Fast
        self.register_profile(StrategyProfile(
            id="fast",
            name="Fast",
            execution_philosophy="Optimizes for speed, bypassing complex validation checks.",
            preferred_provider_types=["ollama"],
            local_cloud_preference="local_only",
            parallelization_policy="parallel",
            validation_frequency="low",
            reflection_cadence="deferred",
            memory_usage_policy="short_term",
            resource_awareness="low",
            cost_awareness="high"
        ))

        # 3. Deep
        self.register_profile(StrategyProfile(
            id="deep",
            name="Deep",
            execution_philosophy="Optimizes for correctness, performing exhaustive verification and self-healing.",
            preferred_provider_types=["litellm"],
            local_cloud_preference="cloud_only",
            parallelization_policy="sequential",
            validation_frequency="high",
            reflection_cadence="per_step",
            memory_usage_policy="full_strata",
            resource_awareness="high",
            cost_awareness="none"
        ))

        # 4. Offline
        self.register_profile(StrategyProfile(
            id="offline",
            name="Offline",
            execution_philosophy="Runs entirely on local hardware, using zero external APIs.",
            preferred_provider_types=["ollama", "lm_studio"],
            local_cloud_preference="local_only",
            parallelization_policy="sequential",
            validation_frequency="medium",
            reflection_cadence="per_phase",
            memory_usage_policy="long_term",
            resource_awareness="high",
            cost_awareness="high"
        ))

        # 5. Research
        self.register_profile(StrategyProfile(
            id="research",
            name="Research",
            execution_philosophy="Optimizes for information gathering, context compilation, and synthesis.",
            preferred_provider_types=["litellm"],
            local_cloud_preference="hybrid",
            parallelization_policy="parallel",
            validation_frequency="low",
            reflection_cadence="deferred",
            memory_usage_policy="full_strata",
            resource_awareness="low",
            cost_awareness="high"
        ))

        # 6. Coding
        self.register_profile(StrategyProfile(
            id="coding",
            name="Coding",
            execution_philosophy="Optimizes for code generation, syntax validation, and testing.",
            preferred_provider_types=["ollama", "litellm"],
            local_cloud_preference="hybrid",
            parallelization_policy="dynamic",
            validation_frequency="high",
            reflection_cadence="per_step",
            memory_usage_policy="long_term",
            resource_awareness="high",
            cost_awareness="high"
        ))

strategy_engine = StrategyEngine()
