"""Provider interface contract — all providers implement this."""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """Single chat message."""

    role: str
    content: str


class ChatRequest(BaseModel):
    """Chat completion request."""

    messages: list[ChatMessage]
    model: str | None = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int | None = None
    tools: list[dict[str, Any]] | None = None


class ChatResponse(BaseModel):
    """Chat completion response."""

    content: str
    model: str
    provider: str
    usage: dict[str, Any] = Field(default_factory=dict)
    finish_reason: str | None = None


class EmbedRequest(BaseModel):
    """Embedding request."""

    texts: list[str]
    model: str | None = None


class EmbedResponse(BaseModel):
    """Embedding response."""

    embeddings: list[list[float]]
    model: str
    provider: str


class ModelInfo(BaseModel):
    """Available model metadata."""

    id: str
    provider: str
    supports_vision: bool = False
    supports_tools: bool = False


class ProviderHealth(BaseModel):
    """Provider health status."""

    provider: str
    healthy: bool
    latency_ms: float | None = None
    message: str | None = None


class LLMProvider(ABC):
    """Abstract LLM provider interface."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier."""

    @abstractmethod
    async def chat(self, request: ChatRequest) -> ChatResponse:
        """Non-streaming chat completion."""

    @abstractmethod
    async def stream(self, request: ChatRequest) -> AsyncIterator[str]:
        """Streaming chat completion yielding content chunks."""

    @abstractmethod
    async def embed(self, request: EmbedRequest) -> EmbedResponse:
        """Generate embeddings."""

    @abstractmethod
    async def vision(self, request: ChatRequest, image_url: str) -> ChatResponse:
        """Vision-capable chat completion."""

    @abstractmethod
    async def tools(self, request: ChatRequest) -> ChatResponse:
        """Tool-calling chat completion."""

    @abstractmethod
    async def models(self) -> list[ModelInfo]:
        """List available models."""

    @abstractmethod
    async def health(self) -> ProviderHealth:
        """Check provider health."""
