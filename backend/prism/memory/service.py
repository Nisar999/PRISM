"""Memory service — orchestrates classifier, scorer, storage, retrieval, healing."""

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from prism.core.logging import get_logger
from prism.core.security.pii import mask_pii
from prism.memory.classifier.classifier import MemoryClassifier
from prism.memory.healing.healer import SelfHealer
from prism.memory.models import MemoryCreate, MemoryResponse, MemorySearchRequest, MemorySearchResult
from prism.memory.retrieval.retriever import MemoryRetriever
from prism.memory.scorer.mem_score import MemScorer
from prism.providers.interface import EmbedRequest
from prism.providers.litellm_provider import LiteLLMProvider
from prism.storage.neo4j.client import Neo4jClient
from prism.storage.postgres.repository import PostgresMemoryRepository
from prism.storage.qdrant.client import QdrantClient
from prism.storage.redis.client import RedisClient

logger = get_logger(__name__)


class MemoryService:
    """High-level memory operations — routes never call storage directly."""

    def __init__(self, session: AsyncSession) -> None:
        self._llm = LiteLLMProvider()
        self._postgres = PostgresMemoryRepository(session)
        self._qdrant = QdrantClient()
        self._neo4j = Neo4jClient()
        self._redis = RedisClient()
        self._classifier = MemoryClassifier(llm=self._llm)
        self._scorer = MemScorer()
        self._healer = SelfHealer(
            self._llm,
            self._postgres,
            self._neo4j,
            trust_sync=self.sync_trust,
        )
        self._retriever = MemoryRetriever(
            self._llm, self._qdrant, self._neo4j, self._redis, self._postgres
        )

    async def create(self, request: MemoryCreate) -> MemoryResponse:
        """Create memory: classify → score → store across all backends."""
        masked_content = mask_pii(request.content)
        memory_type = request.memory_type or await self._classifier.classify(masked_content)
        trust = 0.5
        mem_score = self._scorer.compute(
            memory_type=memory_type,
            trust=trust,
            created_at=datetime.now(UTC),
        )

        record = await self._postgres.create(
            memory_type=memory_type.value,
            content=masked_content,
            trust=trust,
            mem_score=mem_score,
            session_id=request.session_id,
            metadata=request.metadata,
        )

        embed_response = await self._llm.embed(EmbedRequest(texts=[masked_content]))
        await self._qdrant.upsert(
            memory_id=record.id,
            vector=embed_response.embeddings[0],
            memory_type=memory_type.value,
            trust=trust,
            mem_score=mem_score,
            session_id=request.session_id,
        )

        await self._neo4j.create_memory_node(
            str(record.id), memory_type.value, trust, mem_score
        )

        await self._healer.heal_on_create(record.id, masked_content, memory_type)

        refreshed = await self._postgres.get_by_id(record.id)
        if refreshed:
            record = refreshed

        logger.info("memory_created", memory_id=str(record.id), type=memory_type.value)
        return self._to_response(record)

    async def get(self, memory_id: uuid.UUID) -> MemoryResponse | None:
        record = await self._postgres.get_by_id(memory_id)
        return self._to_response(record) if record else None

    async def search(self, request: MemorySearchRequest) -> list[MemorySearchResult]:
        return await self._retriever.retrieve(request)

    async def delete(self, memory_id: uuid.UUID) -> bool:
        deleted = await self._postgres.soft_delete(memory_id)
        if deleted:
            await self._qdrant.delete(memory_id)
        return deleted

    async def sync_trust(self, memory_id: uuid.UUID, trust: float) -> None:
        """Propagate trust updates across PostgreSQL, Qdrant, and Neo4j."""
        record = await self._postgres.update_trust(memory_id, trust=trust)
        if record is None:
            return
        await self._qdrant.update_payload(memory_id, trust=trust, mem_score=record.mem_score)
        await self._neo4j.create_memory_node(
            str(memory_id),
            record.memory_type,
            trust,
            record.mem_score,
        )
        logger.info("trust_synced", memory_id=str(memory_id), trust=trust)

    async def mark_contradiction(
        self, memory_id_a: uuid.UUID, memory_id_b: uuid.UUID
    ) -> None:
        await self._healer.mark_contradiction(memory_id_a, memory_id_b)

    async def heal_contradiction(self, memory_id: uuid.UUID) -> dict:
        return await self._healer.heal_contradiction(memory_id)

    @staticmethod
    def _to_response(record) -> MemoryResponse:
        from prism.memory.models import MemoryType

        return MemoryResponse(
            id=record.id,
            session_id=record.session_id,
            memory_type=MemoryType(record.memory_type),
            content=record.content,
            trust=record.trust,
            mem_score=record.mem_score,
            metadata=record.metadata_,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )
