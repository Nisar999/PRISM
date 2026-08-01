"""Planner agent — breaks tasks and chooses memory strategy."""

from prism.agents.state import AgentState
from prism.agents.model_resolve import (
    resolve_request_api_base,
    resolve_request_api_key,
    resolve_request_model,
    resolve_request_provider,
)
from prism.core.logging import get_logger
from prism.providers.interface import ChatMessage, ChatRequest
from prism.providers.litellm_provider import LiteLLMProvider

logger = get_logger(__name__)

PLANNER_PROMPT = """You are the PRISM OS Planner. Break the user's request into steps and choose a memory strategy.

Memory types available: episodic, semantic, procedural, temporal, failure.

Respond in JSON:
{{"steps": ["step1", "step2"], "memory_strategy": ["semantic", "procedural"], "reasoning": "brief explanation"}}"""


class PlannerAgent:
    """Plans task decomposition and memory retrieval strategy."""

    def __init__(self, llm: LiteLLMProvider | None = None) -> None:
        self._llm = llm or LiteLLMProvider()

    async def run(self, state: AgentState) -> dict:
        user_message = state["messages"][-1].content if state["messages"] else ""
        try:
            request = ChatRequest(
                messages=[
                    ChatMessage(role="system", content=PLANNER_PROMPT),
                    ChatMessage(role="user", content=user_message),
                ],
                temperature=0.3,
                max_tokens=500,
                model=resolve_request_model(state),
                api_key=resolve_request_api_key(state),
                api_base=resolve_request_api_base(state),
                provider_hint=resolve_request_provider(state),
            )
            response = await self._llm.chat(request)
            logger.info("planner_complete", session_id=str(state.get("session_id")))
            return {"plan": response.content, "metadata": {**state.get("metadata", {}), "planner_model": response.model}}
        except Exception as exc:
            logger.error("planner_failed", error=str(exc))
            return {"plan": f"Direct response to: {user_message}", "errors": state.get("errors", []) + [str(exc)]}
