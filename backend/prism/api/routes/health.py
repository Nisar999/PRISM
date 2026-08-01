"""Health check endpoints."""

from datetime import UTC, datetime

from fastapi import APIRouter

from prism.api.schemas.common import DataResponse, MetaResponse
from prism.core.config import get_settings
from prism.storage.neo4j.client import Neo4jClient
from prism.storage.qdrant.client import QdrantClient
from prism.storage.redis.client import RedisClient
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthStatus(BaseModel):
    status: str
    version: str
    environment: str
    services: dict[str, bool]


class ReadinessStatus(BaseModel):
    ready: bool
    checks: dict[str, bool]


@router.get("/health", response_model=DataResponse[HealthStatus])
async def health_check() -> DataResponse[HealthStatus]:
    """Liveness probe."""
    settings = get_settings()
    return DataResponse(
        data=HealthStatus(
            status="healthy",
            version="0.1.0",
            environment=settings.prism_env,
            services={},
        ),
        meta=MetaResponse(timestamp=datetime.now(UTC).isoformat()),
    )


@router.get("/ready", response_model=DataResponse[ReadinessStatus])
async def readiness_check() -> DataResponse[ReadinessStatus]:
    """Readiness probe — checks all storage backends."""
    redis = RedisClient()
    qdrant = QdrantClient()
    neo4j = Neo4jClient()

    checks = {
        "redis": await redis.health_check(),
        "qdrant": await qdrant.health_check(),
        "neo4j": await neo4j.health_check(),
    }

    await redis.close()
    await neo4j.close()

    return DataResponse(
        data=ReadinessStatus(ready=all(checks.values()), checks=checks),
        meta=MetaResponse(timestamp=datetime.now(UTC).isoformat()),
    )
