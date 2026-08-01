"""Retrieval agent — fetches relevant memories across all types."""

from prism.agents.state import AgentState
from prism.core.logging import get_logger
from prism.memory.models import MemorySearchRequest, MemoryType

logger = get_logger(__name__)


class RetrievalAgent:
    """Retrieves memories based on planner strategy."""

    async def run(self, state: AgentState, memory_service=None) -> dict:
        user_message = state["messages"][-1].content if state["messages"] else ""
        memories: list[dict] = []

        if memory_service:
            try:
                strategy = state.get("metadata", {}).get("memory_strategy", [])
                memory_types = [MemoryType(t) for t in strategy] if strategy else None
                request = MemorySearchRequest(query=user_message, memory_types=memory_types, limit=10)
                results = await memory_service.search(request)
                memories = [r.model_dump(mode="json") for r in results]
            except Exception as exc:
                logger.warning("retrieval_failed", error=str(exc))
                return {"retrieved_memories": [], "errors": state.get("errors", []) + [str(exc)]}

        logger.info("retrieval_complete", count=len(memories))
        return {"retrieved_memories": memories}
