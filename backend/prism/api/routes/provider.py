"""LLM provider endpoints."""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from prism.api.schemas.common import DataResponse, MetaResponse
from prism.core.exceptions import ProviderError
from prism.providers.interface import ChatMessage, ChatRequest, ChatResponse, ModelInfo, ProviderHealth
from prism.providers.litellm_provider import LiteLLMProvider
from prism.providers.registry import ALL_PROVIDER_MODELS

router = APIRouter(prefix="/provider", tags=["provider"])


class ChatRequestBody(BaseModel):
    messages: list[ChatMessage] | None = None
    message: str | None = None
    provider: str | None = None
    model: str | None = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int | None = None
    api_key: str | None = None
    endpoint: str | None = None


@router.get("/health", response_model=DataResponse[ProviderHealth])
async def provider_health() -> DataResponse[ProviderHealth]:
    provider = LiteLLMProvider()
    health = await provider.health()
    return DataResponse(data=health, meta=MetaResponse(timestamp=datetime.now(UTC).isoformat()))


@router.get("/models", response_model=DataResponse[list[ModelInfo]])
async def list_models() -> DataResponse[list[ModelInfo]]:
    return DataResponse(
        data=ALL_PROVIDER_MODELS,
        meta=MetaResponse(timestamp=datetime.now(UTC).isoformat()),
    )


def _resolve_chat_messages(body: ChatRequestBody) -> list[ChatMessage]:
    if body.messages:
        return body.messages
    if body.message:
        return [ChatMessage(role="user", content=body.message)]
    raise HTTPException(status_code=422, detail="Either 'messages' or 'message' is required")


def _resolve_model_name(body: ChatRequestBody) -> str | None:
    if body.model is None:
        return None
    if "/" in body.model:
        return body.model
    if body.provider:
        return f"{body.provider}/{body.model}"
    return body.model


@router.post("/chat", response_model=DataResponse[ChatResponse])
async def chat(body: ChatRequestBody) -> DataResponse[ChatResponse]:
    provider = LiteLLMProvider()
    try:
        response = await provider.chat(
            ChatRequest(
                messages=_resolve_chat_messages(body),
                model=_resolve_model_name(body),
                temperature=body.temperature,
                max_tokens=body.max_tokens,
                api_key=body.api_key,
                api_base=body.endpoint.rstrip("/") if body.endpoint else None,
                provider_hint=body.provider,
            )
        )
        return DataResponse(data=response, meta=MetaResponse(timestamp=datetime.now(UTC).isoformat()))
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
