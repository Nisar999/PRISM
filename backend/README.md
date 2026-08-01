# PRISM Backend

**PRISM v0.9.0 Alpha** — Python backend for the Agentic Intelligent Workspace.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Python 3.12 | Runtime |
| FastAPI | Async HTTP API |
| LangGraph | Multi-agent orchestration |
| Pydantic | Schema validation |
| LiteLLM | Provider abstraction |
| Celery | Background workers |

## Package Structure

```
backend/
├── prism/
│   ├── kernel.py              # PRISM Kernel — bootstrap entry point
│   ├── main.py                # FastAPI application factory (`create_app`)
│   ├── worker.py              # Celery worker
│   ├── core/                  # Cognitive pipeline + EventBus
│   ├── memory/                # Memory engine
│   ├── agents/                # LangGraph agent pipeline
│   ├── providers/             # LiteLLM + provider metadata
│   ├── api/                   # REST + WebSocket routes
│   └── storage/               # Postgres / Neo4j / Qdrant / Redis
└── tests/                     # Pytest suite
```

## API Routes

Prefix: `/api/v1`. Success responses use `{ "data": ..., "meta": ... }`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | Liveness |
| GET | `/api/v1/ready` | Readiness (Redis, Qdrant, Neo4j) |
| POST | `/api/v1/agent/invoke` | Invoke agent pipeline |
| POST | `/api/v1/memory` | Create memory |
| GET | `/api/v1/memory/{id}` | Fetch memory |
| POST | `/api/v1/memory/search` | Search memories |
| DELETE | `/api/v1/memory/{id}` | Soft-delete memory |
| GET | `/api/v1/provider/models` | List models |
| GET | `/api/v1/provider/health` | Provider health |
| POST | `/api/v1/provider/chat` | Chat via LiteLLM |
| WS | `/api/v1/events/ws` | EventBus stream |

## Development

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Unix:    source .venv/bin/activate

pip install -e ".[dev]"
cp .env.example .env

# IMPORTANT: factory entrypoint (no module-level `app`)
uvicorn prism.main:create_app --factory --reload --host 127.0.0.1 --port 8000

pytest tests/ -v
```

See [Development Guide](../docs/DEVELOPMENT_GUIDE.md) for Docker hybrid setup.
