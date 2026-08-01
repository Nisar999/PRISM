"""Trust Evaluator agent — audits reflection, avoids false positives."""

from prism.agents.state import AgentState
from prism.core.logging import get_logger

logger = get_logger(__name__)


class TrustEvaluatorAgent:
    """Evaluates trust score for the final answer based on reflection and memory quality."""

    async def run(self, state: AgentState) -> dict:
        memories = state.get("retrieved_memories", [])
        base_trust = 0.7

        if memories:
            avg_memory_trust = sum(
                m.get("memory", {}).get("trust", 0.5) for m in memories
            ) / len(memories)
            base_trust = (base_trust + avg_memory_trust) / 2

        if state.get("errors"):
            base_trust *= 0.5

        reflection = state.get("reflection", "") or ""
        if "reject" in reflection.lower():
            base_trust *= 0.3
        elif "revise" in reflection.lower():
            base_trust *= 0.7

        trust_score = round(min(1.0, max(0.0, base_trust)), 3)
        logger.info("trust_evaluated", score=trust_score)
        return {"trust_score": trust_score}
