"""Reflection agent — checks hallucinations, contradictions, unsupported claims."""

from prism.agents.state import AgentState
from prism.agents.model_resolve import resolve_request_api_key, resolve_request_model
from prism.core.logging import get_logger
from prism.providers.interface import ChatMessage, ChatRequest
from prism.providers.litellm_provider import LiteLLMProvider

logger = get_logger(__name__)

REFLECTION_PROMPT = """You are the PRISM OS Reflection agent. Audit the reasoning for:

1. Hallucinations (claims not supported by memories)
2. Contradictions (conflicts with retrieved memories)
3. Unsupported claims
4. Low trust memories used without caveat

Respond in JSON:
{{"passed": bool, "issues": [], "confidence": 0.0-1.0, "recommendation": "accept|revise|reject"}}

Reasoning to audit:
{reasoning}

Memories used:
{memories}"""


class ReflectionAgent:
    """Validates reasoning quality before final output."""

    def __init__(self, llm: LiteLLMProvider | None = None) -> None:
        self._llm = llm or LiteLLMProvider()

    async def run(self, state: AgentState) -> dict:
        try:
            request = ChatRequest(
                messages=[
                    ChatMessage(
                        role="user",
                        content=REFLECTION_PROMPT.format(
                            reasoning=state.get("reasoning", ""),
                            memories=state.get("retrieved_memories", []),
                        ),
                    )
                ],
                temperature=0.0,
                max_tokens=500,
                model=resolve_request_model(state),
                api_key=resolve_request_api_key(state),
            )
            response = await self._llm.chat(request)
            logger.info("reflection_complete")
            return {
                "reflection": response.content,
                "metadata": {**state.get("metadata", {}), "reflection_result": response.content},
            }
        except Exception as exc:
            logger.warning("reflection_failed", error=str(exc))
            return {"reflection": None, "errors": state.get("errors", []) + [str(exc)]}
