"""Memory domain models and schemas."""

import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class MemoryType(StrEnum):
    """Five PRISM memory layers — never mix types."""

    EPISODIC = "episodic"
    SEMANTIC = "semantic"
    PROCEDURAL = "procedural"
    TEMPORAL = "temporal"
    FAILURE = "failure"


class MemoryCreate(BaseModel):
    """Request to create a new memory."""

    content: str = Field(min_length=1)
    session_id: uuid.UUID | None = None
    memory_type: MemoryType | None = None
    metadata: dict = Field(default_factory=dict)


class MemoryResponse(BaseModel):
    """Memory response schema."""

    id: uuid.UUID
    session_id: uuid.UUID | None
    memory_type: MemoryType
    content: str
    trust: float
    mem_score: float
    metadata: dict
    created_at: datetime
    updated_at: datetime


class MemorySearchRequest(BaseModel):
    """Memory retrieval request."""

    query: str = Field(min_length=1)
    memory_types: list[MemoryType] | None = None
    limit: int = Field(default=10, ge=1, le=100)
    min_trust: float = Field(default=0.0, ge=0.0, le=1.0)


class MemorySearchResult(BaseModel):
    """Single retrieval result."""

    memory: MemoryResponse
    relevance_score: float
    source: str = "vector"


# Decay rules per memory type
DECAY_RATES: dict[MemoryType, float | None] = {
    MemoryType.EPISODIC: 0.01,
    MemoryType.SEMANTIC: 0.005,
    MemoryType.PROCEDURAL: 0.002,
    MemoryType.TEMPORAL: 0.05,
    MemoryType.FAILURE: None,  # Never decays
}
