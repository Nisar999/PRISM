"""Application configuration via Pydantic Settings."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from prism.core.config_manager import config_manager


class Settings(BaseSettings):
    """PRISM OS configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    prism_env: str = Field(default="development", alias="PRISM_ENV")
    prism_debug: bool = Field(default=False, alias="PRISM_DEBUG")
    prism_secret_key: str = Field(default="change-me", alias="PRISM_SECRET_KEY")
    api_v1_prefix: str = "/api/v1"

    # PostgreSQL
    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_user: str = Field(default="prism", alias="POSTGRES_USER")
    postgres_password: str = Field(default="prism_secret", alias="POSTGRES_PASSWORD")
    postgres_db: str = Field(default="prism", alias="POSTGRES_DB")

    # Neo4j
    neo4j_uri: str = Field(default="bolt://localhost:7687", alias="NEO4J_URI")
    neo4j_user: str = Field(default="neo4j", alias="NEO4J_USER")
    neo4j_password: str = Field(default="prism_neo4j_secret", alias="NEO4J_PASSWORD")

    # Qdrant
    qdrant_host: str = Field(default="localhost", alias="QDRANT_HOST")
    qdrant_port: int = Field(default=6333, alias="QDRANT_PORT")
    qdrant_collection: str = Field(default="prism_memories", alias="QDRANT_COLLECTION")

    # Redis
    redis_host: str = Field(default="localhost", alias="REDIS_HOST")
    redis_port: int = Field(default=6379, alias="REDIS_PORT")
    redis_db: int = Field(default=0, alias="REDIS_DB")

    # Ollama
    ollama_base_url: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")

    # LM Studio
    lmstudio_base_url: str = Field(
        default="http://host.docker.internal:1234", alias="LMSTUDIO_BASE_URL"
    )

    # Provider API Keys
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")

    # LiteLLM
    litellm_default_model: str = Field(default="ollama/llama3.2", alias="LITELLM_DEFAULT_MODEL")
    litellm_fallback_model: str = Field(
        default="openrouter/meta-llama/llama-3.2-3b-instruct:free",
        alias="LITELLM_FALLBACK_MODEL",
    )
    litellm_embedding_model: str = Field(
        default="ollama/nomic-embed-text", alias="LITELLM_EMBEDDING_MODEL"
    )

    # Celery
    celery_broker_url: str = Field(default="redis://localhost:6379/1", alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(
        default="redis://localhost:6379/2", alias="CELERY_RESULT_BACKEND"
    )

    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"


def get_settings() -> Settings:
    """Get settings populated dynamically from the Configuration Manager."""
    cfg = config_manager.get_config()
    return Settings(**cfg.model_dump())
