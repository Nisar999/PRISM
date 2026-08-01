"""LiteLLM provider implementation — single abstraction for all LLM backends."""

import time
from collections.abc import AsyncIterator
from typing import Any

import litellm
from litellm import acompletion, aembedding
from tenacity import retry, stop_after_attempt, wait_exponential

from prism.core.config import Settings, get_settings
from prism.core.exceptions import ProviderError
from prism.core.logging import get_logger
from prism.providers.interface import (
    ChatRequest,
    ChatResponse,
    EmbedRequest,
    EmbedResponse,
    LLMProvider,
    ModelInfo,
    ProviderHealth,
)

logger = get_logger(__name__)

# Suppress LiteLLM verbose logging in production
litellm.suppress_debug_info = True


class LiteLLMProvider(LLMProvider):
    """Unified provider using LiteLLM — never call provider SDKs directly."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._configure_env()

    @property
    def name(self) -> str:
        return "litellm"

    def _configure_env(self) -> None:
        """Configure LiteLLM environment from settings."""
        import os

        if self._settings.openai_api_key:
            os.environ["OPENAI_API_KEY"] = self._settings.openai_api_key
        if self._settings.anthropic_api_key:
            os.environ["ANTHROPIC_API_KEY"] = self._settings.anthropic_api_key
        if self._settings.gemini_api_key:
            os.environ["GEMINI_API_KEY"] = self._settings.gemini_api_key
        if self._settings.openrouter_api_key:
            os.environ["OPENROUTER_API_KEY"] = self._settings.openrouter_api_key

        litellm.api_base = None  # Reset; set per-provider below

    def _resolve_model(self, model: str | None) -> str:
        return model or self._settings.litellm_default_model

    def _build_kwargs(self, request: ChatRequest, model: str) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": [m.model_dump() for m in request.messages],
            "temperature": request.temperature,
        }
        if request.max_tokens:
            kwargs["max_tokens"] = request.max_tokens
        if request.tools:
            kwargs["tools"] = request.tools

        # Provider-specific API base configuration
        if model.startswith("ollama/"):
            kwargs["api_base"] = self._settings.ollama_base_url
        elif model.startswith("lm_studio/") or model.startswith("openai/lm-studio"):
            kwargs["api_base"] = self._settings.lmstudio_base_url

        return kwargs

    def _extract_provider(self, model: str) -> str:
        if "/" in model:
            return model.split("/")[0]
        return "unknown"

    @staticmethod
    def _normalize_usage(usage: Any) -> dict[str, Any]:
        """Normalize LiteLLM usage across providers (Ollama may include null/nested fields)."""
        if usage is None:
            return {}
        if hasattr(usage, "model_dump"):
            return usage.model_dump(exclude_none=True)
        return {k: v for k, v in dict(usage).items() if v is not None}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
    async def chat(self, request: ChatRequest) -> ChatResponse:
        model = self._resolve_model(request.model)
        try:
            response = await acompletion(**self._build_kwargs(request, model))
            choice = response.choices[0]
            return ChatResponse(
                content=choice.message.content or "",
                model=model,
                provider=self._extract_provider(model),
                usage=self._normalize_usage(response.usage),
                finish_reason=choice.finish_reason,
            )
        except ProviderError:
            raise
        except Exception as exc:
            logger.warning("chat_failed", model=model, error=str(exc))
            return await self._fallback_chat(request, exc)

    async def _fallback_chat(self, request: ChatRequest, original_error: Exception) -> ChatResponse:
        """Fallback chain: OpenRouter → local model → graceful error."""
        if not self._settings.openrouter_api_key:
            raise ProviderError(
                f"Provider failed: {original_error}",
                provider=self._extract_provider(self._resolve_model(request.model)),
            ) from original_error

        fallback_model = self._settings.litellm_fallback_model
        if request.model == fallback_model:
            raise ProviderError(
                f"All providers failed: {original_error}",
                provider=self.name,
            ) from original_error

        logger.info("provider_fallback", fallback_model=fallback_model)
        fallback_request = request.model_copy(update={"model": fallback_model})
        try:
            return await self.chat(fallback_request)
        except ProviderError:
            raise ProviderError(
                f"Primary and fallback providers failed: {original_error}",
                provider=self.name,
            ) from original_error

    async def stream(self, request: ChatRequest) -> AsyncIterator[str]:
        model = self._resolve_model(request.model)
        kwargs = self._build_kwargs(request, model)
        kwargs["stream"] = True

        try:
            response = await acompletion(**kwargs)
            async for chunk in response:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield delta.content
        except Exception as exc:
            raise ProviderError(f"Stream failed: {exc}", provider=self._extract_provider(model)) from exc

    async def embed(self, request: EmbedRequest) -> EmbedResponse:
        model = request.model or self._settings.litellm_embedding_model
        kwargs: dict[str, Any] = {
            "model": model,
            "input": request.texts,
        }
        if model.startswith("ollama/"):
            kwargs["api_base"] = self._settings.ollama_base_url

        try:
            response = await aembedding(**kwargs)
            embeddings = [item["embedding"] for item in response.data]
            return EmbedResponse(
                embeddings=embeddings,
                model=model,
                provider=self._extract_provider(model),
            )
        except Exception as exc:
            raise ProviderError(f"Embedding failed: {exc}", provider=self._extract_provider(model)) from exc

    async def vision(self, request: ChatRequest, image_url: str) -> ChatResponse:
        vision_messages = [
            {
                "role": m.role,
                "content": (
                    [{"type": "text", "text": m.content}, {"type": "image_url", "image_url": {"url": image_url}}]
                    if m.role == "user"
                    else m.content
                ),
            }
            for m in request.messages
        ]
        model = self._resolve_model(request.model)
        try:
            response = await acompletion(
                model=model,
                messages=vision_messages,
                temperature=request.temperature,
            )
            choice = response.choices[0]
            return ChatResponse(
                content=choice.message.content or "",
                model=model,
                provider=self._extract_provider(model),
            )
        except Exception as exc:
            raise ProviderError(f"Vision failed: {exc}", provider=self._extract_provider(model)) from exc

    async def tools(self, request: ChatRequest) -> ChatResponse:
        if not request.tools:
            raise ProviderError("Tools request requires tools parameter", provider=self.name)
        return await self.chat(request)

    async def models(self) -> list[ModelInfo]:
        """Return known models per configured provider."""
        models: list[ModelInfo] = [
            ModelInfo(id="ollama/llama3.2", provider="ollama"),
            ModelInfo(id="ollama/nomic-embed-text", provider="ollama"),
            ModelInfo(id="lm_studio/local-model", provider="lm_studio"),
            ModelInfo(id="openrouter/meta-llama/llama-3.2-3b-instruct:free", provider="openrouter"),
            ModelInfo(id="gpt-4o", provider="openai", supports_vision=True, supports_tools=True),
            ModelInfo(id="claude-sonnet-4-20250514", provider="anthropic", supports_vision=True, supports_tools=True),
            ModelInfo(id="gemini/gemini-2.0-flash", provider="gemini", supports_vision=True, supports_tools=True),
        ]
        return models

    async def health(self) -> ProviderHealth:
        start = time.perf_counter()
        try:
            await acompletion(
                model=self._settings.litellm_default_model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
                api_base=self._settings.ollama_base_url
                if self._settings.litellm_default_model.startswith("ollama/")
                else None,
            )
            latency = (time.perf_counter() - start) * 1000
            return ProviderHealth(provider=self.name, healthy=True, latency_ms=latency)
        except Exception as exc:
            return ProviderHealth(
                provider=self.name,
                healthy=False,
                message=str(exc),
            )
