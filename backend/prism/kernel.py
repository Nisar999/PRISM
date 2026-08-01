"""PRISM Kernel - Central runtime for lifecycle, dependency management, and communication."""

import logging
from typing import Any, Dict

from prism.core.config import get_settings
from prism.core.logging import setup_logging

logger = logging.getLogger(__name__)

class PrismKernel:
    """Central runtime responsible for PRISM lifecycle and subsystem communication."""
    
    def __init__(self):
        self.settings = None
        self.subsystems: dict[str, Any] = {}
        self.is_initialized = False

    async def initialize(self) -> None:
        """Boot sequence for PRISM Kernel and its subsystems."""
        if self.is_initialized:
            logger.warning("PRISM Kernel is already initialized.")
            return

        from prism.core.mind_registry import mind_registry, PlaceholderSubsystem
        from prism.core.event_bus import event_bus
        from prism.core.config_manager import config_manager
        from prism.core.capability import capability_registry
        from prism.core.skill import skill_registry
        from prism.core.intent import intent_engine
        from prism.core.goal import goal_registry
        from prism.core.strategy import strategy_engine
        from prism.core.knowledge import knowledge_graph
        from prism.core.router import model_router
        from prism.core.planner import cognitive_planner
        from prism.core.context import context_engine
        from prism.core.tool_orchestrator import tool_orchestrator
        from prism.core.execution_runtime import execution_runtime
        from prism.core.subsystems import (
            ProviderSubsystem,
            MemoryEngineSubsystem,
            ReflectionSubsystem,
            HealingSubsystem,
            AgentRuntimeSubsystem
        )

        logger.info("Starting PRISM boot sequence...")

        mind_registry.register("event_bus", event_bus)
        await event_bus.initialize(mind_registry)

        mind_registry.register("configuration", config_manager)
        await config_manager.initialize(mind_registry)
        self.settings = get_settings()
        
        await mind_registry.initialize()
        
        setup_logging(debug=self.settings.prism_debug)
        logger.info("Configuration and Mind Registry subsystems online.")

        # Register all subsystems
        mind_registry.register("provider_layer", ProviderSubsystem())
        mind_registry.register("capability_registry", capability_registry)
        mind_registry.register("skill_registry", skill_registry)
        mind_registry.register("intent_engine", intent_engine)
        mind_registry.register("strategy_engine", strategy_engine)
        mind_registry.register("goal_registry", goal_registry)
        mind_registry.register("knowledge_graph", knowledge_graph)
        mind_registry.register("model_router", model_router)
        mind_registry.register("cognitive_planner", cognitive_planner)
        mind_registry.register("context_engine", context_engine)
        mind_registry.register("tool_orchestrator", tool_orchestrator)
        mind_registry.register("execution_runtime", execution_runtime)
        mind_registry.register("memory_engine", MemoryEngineSubsystem())
        mind_registry.register("reflection_engine", ReflectionSubsystem())
        mind_registry.register("healing_engine", HealingSubsystem())
        mind_registry.register("agent_runtime", AgentRuntimeSubsystem())

        # Placeholders
        mind_registry.register("resource_manager", PlaceholderSubsystem("resource_manager", "Monitors system resources (CPU, GPU, NPU, RAM, storage)."))
        mind_registry.register("workspace_adapter", PlaceholderSubsystem("workspace_adapter", "Adapts external environments to the PRISM API."))
        mind_registry.register("planning_engine", PlaceholderSubsystem("planning_engine", "Deconstructs high-level tasks and schedules execution plans."))
        mind_registry.register("trust_engine", PlaceholderSubsystem("trust_engine", "Audits reflection processes and computes trust scores."))
        mind_registry.register("visualization", PlaceholderSubsystem("visualization", "Generates cognitive graphs and visual states for clients."))

        # Boot sequence — context_engine initialized before cognitive_planner
        subsystems_to_boot = [
            "provider_layer",
            "capability_registry",
            "skill_registry",
            "resource_manager",
            "workspace_adapter",
            "memory_engine",
            "healing_engine",
            "reflection_engine",
            "planning_engine",
            "trust_engine",
            "visualization",
            "tool_orchestrator",
            "execution_runtime",
            "intent_engine",
            "strategy_engine",
            "goal_registry",
            "knowledge_graph",
            "context_engine",
            "model_router",
            "cognitive_planner",
            "agent_runtime"
        ]

        for name in subsystems_to_boot:
            try:
                sub = await mind_registry.lookup(name)
                await sub.initialize(mind_registry)
                self.subsystems[name] = {"status": "initialized"}
                logger.info(f"Subsystem {name} initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize subsystem {name}: {e}", exc_info=True)
                self.subsystems[name] = {"status": "failed", "error": str(e)}

        self.subsystems["configuration"] = {"status": "initialized", "settings": self.settings}
        self.subsystems["future"] = {"status": "initialized"}

        self.is_initialized = True
        logger.info("PRISM Kernel boot sequence complete.")

        await event_bus.publish("kernel_boot", {"status": "success"})

    async def shutdown(self) -> None:
        """Shutdown sequence for PRISM Kernel and its subsystems."""
        if not self.is_initialized:
            logger.warning("PRISM Kernel is not initialized.")
            return

        logger.info("Starting PRISM shutdown sequence...")
        from prism.core.mind_registry import mind_registry
        from prism.core.event_bus import event_bus

        await event_bus.publish("kernel_shutdown", {"status": "shutting_down"})

        all_metadata = mind_registry.get_all_metadata()
        for name in reversed(list(all_metadata.keys())):
            try:
                sub = await mind_registry.lookup(name)
                await sub.shutdown()
                logger.info(f"Subsystem {name} shutdown complete.")
            except Exception as e:
                logger.error(f"Failed to shutdown subsystem {name}: {e}")

        self.is_initialized = False
        logger.info("PRISM Kernel shutdown complete.")

kernel = PrismKernel()
