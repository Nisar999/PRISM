"""Healing agent — applies SelfHealer actions from structured reflection issues."""

import uuid

from prism.agents.reflection.parser import parse_reflection
from prism.agents.state import AgentState
from prism.core.logging import get_logger
from prism.memory.healing.contradiction import (
    find_contradictory_pair_among_ids,
    find_contradictory_pairs,
    memories_from_retrieved,
)

logger = get_logger(__name__)


def _memory_content_index(retrieved_memories: list[dict]) -> dict[uuid.UUID, str]:
    return {
        uuid.UUID(str(item["memory"]["id"])): str(item["memory"].get("content", ""))
        for item in retrieved_memories
        if item.get("memory", {}).get("id")
    }


class HealingAgent:
    """Runs memory self-healing based on reflection audit results."""

    async def _mark_validated_pair(
        self,
        memory_service,
        id_a: uuid.UUID,
        id_b: uuid.UUID,
        marked_pairs: set[frozenset[uuid.UUID]],
        actions: list[dict],
        source: str,
    ) -> None:
        if id_a == id_b:
            return
        pair_key = frozenset({id_a, id_b})
        if pair_key in marked_pairs:
            return
        await memory_service.mark_contradiction(id_a, id_b)
        marked_pairs.add(pair_key)
        actions.append(
            {
                "action": "mark_contradiction",
                "memory_id_a": str(id_a),
                "memory_id_b": str(id_b),
                "new_trust": 0.3,
                "issue_type": "contradiction",
                "source": source,
            }
        )
        logger.info(
            "healing_contradiction_marked",
            memory_a=str(id_a),
            memory_b=str(id_b),
            source=source,
        )

    async def run(self, state: AgentState, memory_service=None) -> dict:
        reflection = state.get("reflection") or state.get("metadata", {}).get("reflection_result")
        parsed = parse_reflection(reflection)
        actions: list[dict] = []
        metadata = {**state.get("metadata", {}), "reflection_parsed": parsed}
        retrieved = state.get("retrieved_memories", [])

        if memory_service is None:
            logger.warning("healing_skipped", reason="no_memory_service")
            return {"healing_actions": actions, "metadata": metadata}

        marked_pairs: set[frozenset[uuid.UUID]] = set()
        content_index = _memory_content_index(retrieved)
        normalized_memories = memories_from_retrieved(retrieved)

        has_contradiction_signal = any(
            issue.get("issue_type") == "contradiction" for issue in parsed.get("issues", [])
        ) or ("contradict" in (reflection or "").lower())

        for issue in parsed.get("issues", []):
            issue_type = issue.get("issue_type", "unknown")
            memory_ids = [uuid.UUID(mid) for mid in issue.get("memory_ids", [])]

            if issue_type != "contradiction":
                if issue_type in {"hallucination", "unsupported_claim", "low_confidence"}:
                    actions.append(
                        {
                            "action": "issue_detected",
                            "issue_type": issue_type,
                            "memory_ids": [str(mid) for mid in memory_ids],
                            "description": issue.get("description", ""),
                        }
                    )
                continue

            validated_pair = find_contradictory_pair_among_ids(content_index, memory_ids)
            if validated_pair:
                id_a, id_b = validated_pair
                await self._mark_validated_pair(
                    memory_service, id_a, id_b, marked_pairs, actions, "reflection_issue"
                )
            elif len(memory_ids) >= 2:
                logger.warning(
                    "healing_skip_unvalidated_pair",
                    memory_ids=[str(mid) for mid in memory_ids[:2]],
                )

        if has_contradiction_signal:
            for id_a, id_b in find_contradictory_pairs(normalized_memories):
                await self._mark_validated_pair(
                    memory_service,
                    id_a,
                    id_b,
                    marked_pairs,
                    actions,
                    "semantic_retrieval_pair",
                )

        contradiction_ids = {
            uuid.UUID(mid)
            for issue in parsed.get("issues", [])
            if issue.get("issue_type") == "contradiction"
            for mid in issue.get("memory_ids", [])
        }
        if (
            parsed.get("passed")
            and parsed.get("recommendation") == "accept"
            and not contradiction_ids
        ):
            for item in retrieved:
                memory = item.get("memory", {})
                memory_id = memory.get("id")
                trust = memory.get("trust", 0.5)
                if memory_id is None or trust > 0.35:
                    continue
                healed = await memory_service.heal_contradiction(uuid.UUID(str(memory_id)))
                if healed.get("healed"):
                    actions.append(
                        {
                            "action": "heal_contradiction",
                            "memory_id": str(memory_id),
                            "new_trust": healed.get("new_trust", 0.85),
                            "issue_type": "repair",
                        }
                    )

        logger.info("healing_complete", actions=len(actions))
        return {"healing_actions": actions, "metadata": metadata}
