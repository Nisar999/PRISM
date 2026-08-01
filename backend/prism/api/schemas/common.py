"""Standard API response envelopes."""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    """Structured error detail."""

    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    """Standard error response."""

    error: ErrorDetail


class MetaResponse(BaseModel):
    """Response metadata."""

    timestamp: str | None = None


class DataResponse(BaseModel, Generic[T]):
    """Standard success response envelope."""

    data: T
    meta: MetaResponse = Field(default_factory=MetaResponse)
