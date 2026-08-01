"""Qdrant vector database client."""

import uuid

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from prism.core.config import get_settings
from prism.core.logging import get_logger

logger = get_logger(__name__)

VECTOR_SIZE = 768


class QdrantClient:
    """Async Qdrant wrapper for memory vector storage."""

    def __init__(self) -> None:
        settings = get_settings()
        self._collection = settings.qdrant_collection
        self._client = AsyncQdrantClient(
            host=settings.qdrant_host,
            port=settings.qdrant_port,
        )

    async def ensure_collection(self) -> None:
        collections = await self._client.get_collections()
        names = [c.name for c in collections.collections]
        if self._collection not in names:
            await self._client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
            )
            logger.info("qdrant_collection_created", collection=self._collection)

    async def health_check(self) -> bool:
        try:
            await self._client.get_collections()
            return True
        except Exception as exc:
            logger.warning("qdrant_health_failed", error=str(exc))
            return False

    async def upsert(
        self,
        memory_id: uuid.UUID,
        vector: list[float],
        memory_type: str,
        trust: float,
        mem_score: float,
        session_id: uuid.UUID | None = None,
    ) -> None:
        await self.ensure_collection()
        point = PointStruct(
            id=str(memory_id),
            vector=vector,
            payload={
                "memory_type": memory_type,
                "trust": trust,
                "mem_score": mem_score,
                "session_id": str(session_id) if session_id else None,
            },
        )
        await self._client.upsert(collection_name=self._collection, points=[point])

    async def search(
        self,
        query_vector: list[float],
        memory_type: str | None = None,
        limit: int = 10,
        min_score: float = 0.5,
    ) -> list[dict]:
        await self.ensure_collection()
        query_filter = None
        if memory_type:
            query_filter = Filter(
                must=[FieldCondition(key="memory_type", match=MatchValue(value=memory_type))]
            )

        results = await self._client.query_points(
            collection_name=self._collection,
            query=query_vector,
            query_filter=query_filter,
            limit=limit,
            score_threshold=min_score,
        )
        return [
            {
                "id": hit.id,
                "score": hit.score,
                "memory_type": hit.payload.get("memory_type") if hit.payload else None,
                "trust": hit.payload.get("trust") if hit.payload else None,
                "mem_score": hit.payload.get("mem_score") if hit.payload else None,
            }
            for hit in results.points
        ]

    async def update_payload(
        self,
        memory_id: uuid.UUID,
        trust: float,
        mem_score: float,
    ) -> None:
        await self.ensure_collection()
        await self._client.set_payload(
            collection_name=self._collection,
            payload={"trust": trust, "mem_score": mem_score},
            points=[str(memory_id)],
        )

    async def delete(self, memory_id: uuid.UUID) -> None:
        await self._client.delete(
            collection_name=self._collection,
            points_selector=[str(memory_id)],
        )
