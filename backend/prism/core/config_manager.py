"""PRISM Configuration Manager Subsystem."""

import json
import os
from pathlib import Path
from typing import Any, Optional
from pydantic import BaseModel
from prism.core.mind_registry import PrismSubsystem, SubsystemMetadata

class ConfigModel(BaseModel):
    """PRISM configuration model with defaults and validation."""
    
    # Application
    prism_env: str = "development"
    prism_debug: bool = False
    prism_secret_key: str = "change-me"
    api_v1_prefix: str = "/api/v1"

    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "prism"
    postgres_password: str = "prism_secret"
    postgres_db: str = "prism"

    # Neo4j
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "prism_neo4j_secret"

    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "prism_memories"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    # Ollama
    ollama_base_url: str = "http://localhost:11434"

    # LM Studio
    lmstudio_base_url: str = "http://host.docker.internal:1234"

    # Provider API Keys
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    openrouter_api_key: str = ""

    # LiteLLM
    litellm_default_model: str = "ollama/llama3.2"
    litellm_fallback_model: str = "openrouter/meta-llama/llama-3.2-3b-instruct:free"
    litellm_embedding_model: str = "ollama/nomic-embed-text"

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"


class ConfigManager(PrismSubsystem):
    """Manages PRISM configuration with layer precedence: Runtime -> Env -> Project Config -> Defaults."""
    
    def __init__(self, config_path: str = ".prism/config/prism.json"):
        metadata = SubsystemMetadata(
            name="configuration",
            version="1.0.0",
            description="Manages layered configuration layers with validation",
            dependencies=[]
        )
        super().__init__(metadata)
        self.config_path = self._resolve_config_path(config_path)
        self._runtime_overrides: dict[str, Any] = {}
        self._config: Optional[ConfigModel] = None

    def _resolve_config_path(self, config_path: str) -> Path:
        """Helper to resolve .prism/config/prism.json from current working directory or ancestors."""
        path = Path(config_path)
        if path.is_absolute():
            return path
            
        current = Path.cwd()
        for parent in [current] + list(current.parents):
            test_path = parent / config_path
            if test_path.exists():
                return test_path
        return Path(config_path)

    async def initialize(self, registry: Any) -> None:
        """Initializes the manager and pre-loads configuration."""
        self.metadata.status = "initializing"
        self.metadata.lifecycle_state = "active"
        self.load_config()
        self.metadata.status = "active"
        self.metadata.health = "healthy"

    def set_override(self, key: str, value: Any) -> None:
        """Apply a runtime override."""
        self._runtime_overrides[key] = value
        self.load_config()

    def remove_override(self, key: str) -> None:
        """Remove a runtime override."""
        self._runtime_overrides.pop(key, None)
        self.load_config()

    def load_config(self) -> ConfigModel:
        """Loads configuration from all layers in precedence order."""
        config_dict = {}

        # Layer 4: Defaults are loaded by ConfigModel instantiation
        
        # Layer 3: Project Configuration (.prism/config/prism.json)
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    project_config = json.load(f)
                    if isinstance(project_config, dict):
                        config_dict.update(project_config)
            except Exception:
                pass

        # Layer 2: Environment Variables
        for field in ConfigModel.model_fields.keys():
            env_key = field.upper()
            if env_key in os.environ:
                config_dict[field] = os.environ[env_key]
            elif field in os.environ:
                config_dict[field] = os.environ[field]

        # Layer 1: Runtime Overrides
        config_dict.update(self._runtime_overrides)

        self._config = ConfigModel(**config_dict)
        return self._config

    def get_config(self) -> ConfigModel:
        """Get the current configuration. Loads it if not already cached."""
        if self._config is None:
            return self.load_config()
        return self._config


config_manager = ConfigManager()
