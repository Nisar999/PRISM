"""Adaptive memory retrieval across vector, graph, and cache layers."""

import hashlib
import uuid

from prism.core.logging import get_logger
from prism.memory.models import MemoryResponse, MemorySearchRequest, MemorySearchResult, MemoryType
from prism.providers.interface import EmbedRequest, LLMProvider
from prism.storage.neo4j.client import Neo4jClient
from prism.storage.postgres.repository import PostgresMemoryRepository
from prism.storage.qdrant.client import QdrantClient
from prism.storage.redis.client import RedisClient

logger = get_logger(__name__)


class MemoryRetriever:
    """Multi-store adaptive retrieval with Redis caching."""

    def __init__(
        self,
        llm: LLMProvider,
        qdrant: QdrantClient,
        neo4j: Neo4jClient,
        redis: RedisClient,
        postgres_repo: PostgresMemoryRepository,
    ) -> None:
        self._llm = llm
        self._qdrant = qdrant
        self._neo4j = neo4j
        self._redis = redis
        self._postgres = postgres_repo

    def _cache_key(self, request: MemorySearchRequest) -> str:
        raw = f"{request.query}:{request.memory_types}:{request.limit}:{request.min_trust}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    async def retrieve(self, request: MemorySearchRequest) -> list[MemorySearchResult]:
        """Retrieve memories using vector search with graph enrichment."""
        cache_key = self._cache_key(request)
        cached = await self._redis.get_cached_retrieval(cache_key)
        if cached:
            logger.debug("retrieval_cache_hit", key=cache_key)
            return [MemorySearchResult(**item) for item in cached]

        embed_response = await self._llm.embed(EmbedRequest(texts=[request.query]))
        query_vector = embed_response.embeddings[0]

        types_to_search = request.memory_types or list(MemoryType)
        all_results: list[MemorySearchResult] = []

        for memory_type in types_to_search:
            vector_hits = await self._qdrant.search(
                query_vector=query_vector,
                memory_type=memory_type.value,
                limit=request.limit,
            )

            for hit in vector_hits:
                memory_id = uuid.UUID(str(hit["id"]))
                record = await self._postgres.get_by_id(memory_id)
                if record is None or record.trust < request.min_trust:
                    continue

                memory = MemoryResponse(
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
                all_results.append(
                    MemorySearchResult(
                        memory=memory,
                        relevance_score=hit["score"],
                        source="vector",
                    )
                )

        all_results.sort(key=lambda r: r.relevance_score * r.memory.mem_score, reverse=True)
        final = all_results[: request.limit]

        await self._redis.cache_memory_retrieval(
            cache_key, [r.model_dump(mode="json") for r in final]
        )
        return final

    async def retrieve_with_graph(self, memory_id: uuid.UUID, depth: int = 2) -> list[dict]:
        """Enrich retrieval with Neo4j relationship context."""
        return await self._neo4j.find_related(str(memory_id), depth=depth)
