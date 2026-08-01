"""Provider-specific model prefix helpers."""

from prism.providers.interface import ModelInfo

OLLAMA_MODELS = [
    ModelInfo(id="ollama/llama3.2", provider="ollama"),
    ModelInfo(id="ollama/mistral", provider="ollama"),
    ModelInfo(id="ollama/nomic-embed-text", provider="ollama"),
]

LMSTUDIO_MODELS = [
    ModelInfo(id="lm_studio/local-model", provider="lm_studio"),
]

OPENROUTER_MODELS = [
    ModelInfo(id="openrouter/meta-llama/llama-3.2-3b-instruct:free", provider="openrouter"),
    ModelInfo(id="openrouter/deepseek/deepseek-r1", provider="openrouter"),
]

OPENAI_MODELS = [
    ModelInfo(id="gpt-4o", provider="openai", supports_vision=True, supports_tools=True),
    ModelInfo(id="gpt-4o-mini", provider="openai", supports_vision=True, supports_tools=True),
]

ANTHROPIC_MODELS = [
    ModelInfo(
        id="anthropic/claude-sonnet-4-20250514",
        provider="anthropic",
        supports_vision=True,
        supports_tools=True,
    ),
]

GEMINI_MODELS = [
    ModelInfo(
        id="gemini/gemini-2.0-flash",
        provider="gemini",
        supports_vision=True,
        supports_tools=True,
    ),
]

ALL_PROVIDER_MODELS = (
    OLLAMA_MODELS + LMSTUDIO_MODELS + OPENROUTER_MODELS + OPENAI_MODELS + ANTHROPIC_MODELS + GEMINI_MODELS
)
