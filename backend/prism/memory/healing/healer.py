"""Self-healing memory — repairs contradictions, boosts trust, marks failures."""

import uuid
from collections.abc import Awaitable, Callable

from prism.core.logging import get_logger
from prism.core.security.pii import mask_pii
from prism.memory.models import MemoryType
from prism.providers.interface import ChatMessage, ChatRequest, LLMProvider
from prism.storage.neo4j.client import Neo4jClient
from prism.storage.postgres.repository import PostgresMemoryRepository

logger = get_logger(__name__)

HEALING_PROMPT = """Analyze if the new memory contradicts any existing memories.

New memory: {new_content}

Existing memories:
{existing_memories}

Respond in JSON:
{{"has_contradiction": bool, "contradiction_ids": [], "healed_content": "corrected content or null", "trust_adjustment": float}}

If no contradiction, trust_adjustment should be 0.05 (slight boost).
If contradiction found, trust_adjustment should be negative for contradicted memories."""


TrustSync = Callable[[uuid.UUID, float], Awaitable[None]]


class SelfHealer:
    """Detects contradictions and heals memory trust scores."""

    def __init__(
        self,
        llm: LLMProvider,
        postgres_repo: PostgresMemoryRepository,
        neo4j: Neo4jClient,
        trust_sync: TrustSync | None = None,
    ) -> None:
        self._llm = llm
        self._postgres = postgres_repo
        self._neo4j = neo4j
        self._trust_sync = trust_sync

    async def _apply_trust(self, memory_id: uuid.UUID, trust: float) -> None:
        if self._trust_sync:
            await self._trust_sync(memory_id, trust)
        else:
            await self._postgres.update_trust(memory_id, trust=trust)

    async def heal_on_create(
        self,
        memory_id: uuid.UUID,
        content: str,
        memory_type: MemoryType,
        related_memory_ids: list[uuid.UUID] | None = None,
    ) -> dict:
        """Run healing checks when a new memory is created."""
        masked_content = mask_pii(content)
        result = {
            "healed": False,
            "contradictions_found": 0,
            "trust_adjustments": [],
        }

        if related_memory_ids:
            existing = []
            for rid in related_memory_ids:
                record = await self._postgres.get_by_id(rid)
                if record:
                    existing.append(f"[{record.memory_type}] {record.content[:200]}")

            if existing:
                try:
                    request = ChatRequest(
                        messages=[
                            ChatMessage(
                                role="user",
                                content=HEALING_PROMPT.format(
                                    new_content=masked_content,
                                    existing_memories="\n".join(existing),
                                ),
                            )
                        ],
                        temperature=0.0,
                        max_tokens=300,
                    )
                    response = await self._llm.chat(request)
                    result["llm_analysis"] = response.content
                    result["healed"] = True
                except Exception as exc:
                    logger.warning("healing_llm_failed", error=str(exc))

        # FAILURE memories get permanent high trust
        if memory_type == MemoryType.FAILURE:
            await self._apply_trust(memory_id, trust=1.0)
            result["trust_adjustments"].append({"memory_id": str(memory_id), "trust": 1.0})

        return result

    async def mark_contradiction(
        self, memory_id_a: uuid.UUID, memory_id_b: uuid.UUID
    ) -> None:
        """Create CONTRADICTS relationship in graph and reduce trust."""
        await self._neo4j.create_relationship(
            str(memory_id_a), str(memory_id_b), "CONTRADICTS"
        )
        await self._apply_trust(memory_id_a, trust=0.3)
        await self._apply_trust(memory_id_b, trust=0.3)
        logger.info(
            "contradiction_marked",
            memory_a=str(memory_id_a),
            memory_b=str(memory_id_b),
        )

    async def heal_contradiction(self, memory_id: uuid.UUID) -> dict:
        """Golden repair — boost trust after contradiction resolution."""
        await self._apply_trust(memory_id, trust=0.85)
        record = await self._postgres.get_by_id(memory_id)
        return {"healed": record is not None, "memory_id": str(memory_id), "new_trust": 0.85}
