"""PostgreSQL async SQLAlchemy setup."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from prism.core.config import get_settings


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""


settings = get_settings()
engine = create_async_engine(settings.postgres_dsn, echo=settings.prism_debug, pool_pre_ping=True)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
