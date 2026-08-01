"""Redis cache client."""

import json
from typing import Any

import redis.asyncio as aioredis

from prism.core.config import get_settings
from prism.core.logging import get_logger

logger = get_logger(__name__)


class RedisClient:
    """Async Redis wrapper for caching and pub/sub."""

    def __init__(self) -> None:
        settings = get_settings()
        self._client = aioredis.from_url(settings.redis_url, decode_responses=True)

    async def close(self) -> None:
        await self._client.aclose()

    async def health_check(self) -> bool:
        try:
            return await self._client.ping()
        except Exception as exc:
            logger.warning("redis_health_failed", error=str(exc))
            return False

    async def get(self, key: str) -> Any | None:
        value = await self._client.get(key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value

    async def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> None:
        serialized = json.dumps(value) if not isinstance(value, str) else value
        await self._client.set(key, serialized, ex=ttl_seconds)

    async def delete(self, key: str) -> None:
        await self._client.delete(key)

    async def cache_memory_retrieval(self, query_hash: str, results: list[dict], ttl: int = 300) -> None:
        await self.set(f"memory:retrieval:{query_hash}", results, ttl_seconds=ttl)

    async def get_cached_retrieval(self, query_hash: str) -> list[dict] | None:
        cached = await self.get(f"memory:retrieval:{query_hash}")
        return cached if isinstance(cached, list) else None
