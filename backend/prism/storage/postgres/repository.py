"""PostgreSQL memory repository."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from prism.storage.postgres.models import MemoryRecord


class PostgresMemoryRepository:
    """Repository for memory CRUD in PostgreSQL."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        memory_type: str,
        content: str,
        trust: float,
        mem_score: float,
        session_id: uuid.UUID | None = None,
        metadata: dict | None = None,
    ) -> MemoryRecord:
        record = MemoryRecord(
            session_id=session_id,
            memory_type=memory_type,
            content=content,
            trust=trust,
            mem_score=mem_score,
            metadata_=metadata or {},
        )
        self._session.add(record)
        await self._session.flush()
        return record

    async def get_by_id(self, memory_id: uuid.UUID) -> MemoryRecord | None:
        result = await self._session.execute(
            select(MemoryRecord).where(
                MemoryRecord.id == memory_id,
                MemoryRecord.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_by_type(
        self, memory_type: str, limit: int = 50, offset: int = 0
    ) -> list[MemoryRecord]:
        result = await self._session.execute(
            select(MemoryRecord)
            .where(MemoryRecord.memory_type == memory_type, MemoryRecord.deleted_at.is_(None))
            .order_by(MemoryRecord.mem_score.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def update_trust(self, memory_id: uuid.UUID, trust: float) -> MemoryRecord | None:
        record = await self.get_by_id(memory_id)
        if record is None:
            return None
        record.trust = trust
        record.updated_at = datetime.now(UTC)
        await self._session.flush()
        return record

    async def soft_delete(self, memory_id: uuid.UUID) -> bool:
        record = await self.get_by_id(memory_id)
        if record is None:
            return False
        record.deleted_at = datetime.now(UTC)
        await self._session.flush()
        return True
