"""FastAPI application factory."""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app

from prism.api.routes import agent, health, memory, provider, events
from prism.core.config import get_settings
from prism.core.exceptions import PrismError
from prism.core.logging import setup_logging
from prism.storage.postgres.database import Base, engine


from prism.kernel import kernel

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup: initialize kernel, create tables, init connections. Shutdown: cleanup."""
    await kernel.initialize()

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        from prism.core.logging import get_logger

        get_logger(__name__).warning("db_init_deferred", error=str(exc))

    yield

    await engine.dispose()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="PRISM OS",
        description="Persistent Reasoning with Intelligent Self-healing Memory Operating System",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # Desktop Vite (1420) + Tauri webview origins. Debug keeps wildcard for local tooling.
    desktop_origins = [
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "tauri://localhost",
        "https://tauri.localhost",
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.prism_debug else desktop_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(PrismError)
    async def prism_error_handler(request: Request, exc: PrismError) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
        )

    api_prefix = settings.api_v1_prefix
    app.include_router(health.router, prefix=api_prefix)
    app.include_router(provider.router, prefix=api_prefix)
    app.include_router(memory.router, prefix=api_prefix)
    app.include_router(agent.router, prefix=api_prefix)
    app.include_router(events.router, prefix=api_prefix)

    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

    return app
