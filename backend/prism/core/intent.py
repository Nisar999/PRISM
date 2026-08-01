"""PRISM Intent Engine Subsystem."""

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from prism.core.mind_registry import PrismSubsystem, SubsystemMetadata
from prism.core.capability import Capability, CapabilityMetadata

logger = logging.getLogger(__name__)

from prism.core.goal import Goal

class Intent(BaseModel):
    raw_request: str
    category: str  # feature development, debugging, architecture, research, documentation, refactoring, planning, memory operation, system management
    primary_objective: str
    required_capabilities: List[str] = Field(default_factory=list)
    relevant_skills: List[str] = Field(default_factory=list)
    required_tools: List[str] = Field(default_factory=list)
    estimated_complexity: str  # low, medium, high
    resolved_goal: Optional[Goal] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class IntentEngine(PrismSubsystem):
    """Subsystem responsible for translating user objectives into structured execution goals."""

    def __init__(self):
        super().__init__(SubsystemMetadata(
            name="intent_engine",
            version="1.0.0",
            description="Translates user requests into structured intent metadata.",
            dependencies=["configuration", "provider_layer", "capability_registry", "skill_registry"]
        ))
        self._registry = None

    async def initialize(self, registry: Any) -> None:
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"
        self._registry = registry
        
        # Register as a capability in CapabilityRegistry if available
        try:
            cap_registry = await registry.lookup("capability_registry")
            cap_registry.register(Capability(CapabilityMetadata(
                id="intent_engine",
                name="Intent Engine",
                version="1.0.0",
                description="Translates requests into structured intent goals."
            )))
        except Exception as e:
            logger.warning(f"Could not register intent_engine in CapabilityRegistry: {e}")

        self.metadata.status = "active"
        self.metadata.health = "healthy"
        logger.info("Intent Engine initialized.")

    async def classify(self, request: str) -> Intent:
        """Classifies request into a structured Intent object and resolves Goal."""
        logger.info(f"Classifying request: {request[:50]}...")
        
        intent = None
        # Try to resolve via Provider Layer (LLM) if active
        try:
            provider_sub = await self._registry.lookup("provider_layer")
            if provider_sub.metadata.health == "healthy" and provider_sub.provider:
                intent = await self._classify_with_llm(provider_sub.provider, request)
        except Exception as e:
            logger.debug(f"LLM classification bypassed: {e}")
            
        if not intent:
            # Fall back to heuristic rule-based classifier
            intent = self._classify_heuristically(request)

        # Resolve to Goal Template automatically
        try:
            goal_registry = await self._registry.lookup("goal_registry")
            goal = await goal_registry.resolve_goal(intent.category, intent.primary_objective, intent.metadata)
            intent.resolved_goal = goal
        except Exception as e:
            logger.warning(f"Could not resolve goal from intent: {e}")

        return intent

    async def _classify_with_llm(self, provider: Any, request: str) -> Intent:
        system_prompt = (
            "You are the PRISM Intent Engine. Classify the user request into a structured JSON representation.\n"
            "Categories allowed: 'feature development', 'debugging', 'architecture', 'research', 'documentation', 'refactoring', 'planning', 'memory operation', 'system management'.\n"
            "Complexity: 'low', 'medium', 'high'.\n"
            "Format your output strictly as a JSON object matching this schema:\n"
            "{\n"
            "  \"category\": \"category_name\",\n"
            "  \"primary_objective\": \"summarized primary objective\",\n"
            "  \"required_capabilities\": [\"list\", \"of\", \"capabilities\"],\n"
            "  \"relevant_skills\": [\"list\", \"of\", \"relevant\", \"cursor\", \"skills\"],\n"
            "  \"required_tools\": [\"list\", \"of\", \"tools\"],\n"
            "  \"estimated_complexity\": \"low/medium/high\",\n"
            "  \"metadata\": {}\n"
            "}"
        )
        
        from prism.providers.interface import ChatRequest, Message
        try:
            cap_reg = await self._registry.lookup("capability_registry")
            available_caps = list(cap_reg.get_capabilities().keys())
            
            skill_reg = await self._registry.lookup("skill_registry")
            available_skills = list(skill_reg.get_skills().keys())
            
            prompt_context = f"\nAvailable Capabilities: {available_caps}\nAvailable Skills: {available_skills}"
            
            chat_response = await provider.chat(ChatRequest(
                messages=[
                    Message(role="system", content=system_prompt + prompt_context),
                    Message(role="user", content=request)
                ],
                model=None
            ))
            
            import json
            import re
            content = chat_response.content.strip()
            json_match = re.search(r"\{.*\}", content, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(0))
                return Intent(
                    raw_request=request,
                    category=data.get("category", "research"),
                    primary_objective=data.get("primary_objective", request[:100]),
                    required_capabilities=data.get("required_capabilities", []),
                    relevant_skills=data.get("relevant_skills", []),
                    required_tools=data.get("required_tools", []),
                    estimated_complexity=data.get("estimated_complexity", "medium"),
                    metadata=data.get("metadata", {})
                )
        except Exception as e:
            logger.error(f"Error during LLM classification: {e}")
            
        return self._classify_heuristically(request)

    def _classify_heuristically(self, request: str) -> Intent:
        req_lower = request.lower()
        category = "research"
        required_capabilities = []
        relevant_skills = []
        required_tools = []
        complexity = "low"
        
        if any(x in req_lower for x in ["create", "build", "implement", "add feature"]):
            category = "feature development"
            complexity = "medium"
            required_capabilities = ["tool_runtime", "capability_registry"]
            relevant_skills = ["backend-engineer", "frontend-engineer"]
        elif any(x in req_lower for x in ["fix", "bug", "error", "fail", "issue", "debug"]):
            category = "debugging"
            complexity = "medium"
            required_capabilities = ["reflection", "healing"]
            relevant_skills = ["qa-test-automation", "backend-engineer"]
        elif any(x in req_lower for x in ["refactor", "clean", "rewrite"]):
            category = "refactoring"
            complexity = "medium"
            required_capabilities = ["tool_runtime"]
            relevant_skills = ["backend-engineer"]
        elif any(x in req_lower for x in ["design", "architecture", "adr", "structure"]):
            category = "architecture"
            complexity = "high"
            required_capabilities = ["planning"]
            relevant_skills = ["system-design-architecture", "cloud-architecture"]
        elif any(x in req_lower for x in ["remember", "forget", "memory", "store", "save"]):
            category = "memory operation"
            required_capabilities = ["memory"]
            relevant_skills = ["database-engineering"]
        elif any(x in req_lower for x in ["documentation", "readme", "comment"]):
            category = "documentation"
            required_capabilities = ["visualization"]
            relevant_skills = ["technical-writing"]
        elif any(x in req_lower for x in ["deploy", "docker", "ci", "cd", "yaml"]):
            category = "system management"
            complexity = "medium"
            required_capabilities = ["resource_manager"]
            relevant_skills = ["devops", "site-reliability-engineering"]
            
        if len(request) > 200:
            complexity = "high" if complexity == "medium" else "medium"

        return Intent(
            raw_request=request,
            category=category,
            primary_objective=f"Objective based on heuristic classification of request: {request[:60]}...",
            required_capabilities=required_capabilities,
            relevant_skills=relevant_skills,
            required_tools=required_tools,
            estimated_complexity=complexity,
            metadata={"classifier": "heuristic"}
        )

intent_engine = IntentEngine()
