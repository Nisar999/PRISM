"""Application-wide exception hierarchy."""

from typing import Any


class PrismError(Exception):
    """Base exception for PRISM OS."""

    def __init__(self, message: str, code: str = "PRISM_ERROR", details: dict[str, Any] | None = None):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(message)


class ProviderError(PrismError):
    """LLM provider failure."""

    def __init__(self, message: str, provider: str, details: dict[str, Any] | None = None):
        super().__init__(message, code="PROVIDER_ERROR", details={"provider": provider, **(details or {})})


class MemoryError(PrismError):
    """Memory engine failure."""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(message, code="MEMORY_ERROR", details=details)


class StorageError(PrismError):
    """Database/storage failure."""

    def __init__(self, message: str, store: str, details: dict[str, Any] | None = None):
        super().__init__(message, code="STORAGE_ERROR", details={"store": store, **(details or {})})


class AgentError(PrismError):
    """Agent execution failure."""

    def __init__(self, message: str, agent: str, details: dict[str, Any] | None = None):
        super().__init__(message, code="AGENT_ERROR", details={"agent": agent, **(details or {})})
