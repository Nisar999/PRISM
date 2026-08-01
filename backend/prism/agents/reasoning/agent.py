"""Reasoning agent — CoT, ReAct, tool calling."""

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

REASONING_PROMPT = """You are the PRISM OS Reasoning engine. Use Chain of Thought to answer.

Plan: {plan}
Retrieved Memories: {memories}

Think step by step. Cite memory IDs when used. Be transparent about your reasoning."""


class ReasoningAgent:
    """Generates reasoned responses using CoT and retrieved context."""

    def __init__(self, llm: LiteLLMProvider | None = None) -> None:
        self._llm = llm or LiteLLMProvider()

    async def run(self, state: AgentState) -> dict:
        user_message = state["messages"][-1].content if state["messages"] else ""
        try:
            request = ChatRequest(
                messages=[
                    ChatMessage(
                        role="system",
                        content=REASONING_PROMPT.format(
                            plan=state.get("plan", "No plan"),
                            memories=state.get("retrieved_memories", []),
                        ),
                    ),
                    ChatMessage(role="user", content=user_message),
                ],
                temperature=0.5,
                max_tokens=2000,
                model=resolve_request_model(state),
                api_key=resolve_request_api_key(state),
                api_base=resolve_request_api_base(state),
                provider_hint=resolve_request_provider(state),
            )
            response = await self._llm.chat(request)
            return {
                "reasoning": response.content,
                "final_answer": response.content,
            }
        except Exception as exc:
            logger.error("reasoning_failed", error=str(exc))
            return {
                "reasoning": None,
                "final_answer": "I encountered an error while reasoning. Please try again.",
                "errors": state.get("errors", []) + [str(exc)],
            }
