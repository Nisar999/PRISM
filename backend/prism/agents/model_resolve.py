"""Shared helpers for agent nodes."""

from __future__ import annotations

from prism.agents.state import AgentState


def resolve_request_model(state: AgentState) -> str | None:
    """Map desktop provider/model metadata onto a LiteLLM model id."""
    meta = state.get("metadata") or {}
    model = meta.get("model")
    provider = meta.get("provider")
    if not model or not isinstance(model, str):
        return None
    model = model.strip()
    if not model or model.startswith("("):
        return None
    if "/" in model:
        return model
    if not provider or not isinstance(provider, str):
        return model
    provider = provider.strip().lower()
    if provider == "ollama":
        return f"ollama/{model}"
    if provider in {"lmstudio", "lm_studio"}:
        return f"openai/{model}"
    if provider == "openrouter":
        return f"openrouter/{model}"
    if provider == "openai":
        return f"openai/{model}"
    if provider == "anthropic":
        return f"anthropic/{model}"
    if provider == "gemini":
        return f"gemini/{model}"
    if provider.startswith("oai_compat_"):
        return f"openai/{model}"
    return model


def resolve_request_api_key(state: AgentState) -> str | None:
    """Optional per-request API key from desktop (OpenRouter / cloud gateways)."""
    meta = state.get("metadata") or {}
    key = meta.get("api_key")
    if not key or not isinstance(key, str):
        return None
    key = key.strip()
    return key or None
