"""Memory CRUD and search endpoints."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from prism.api.schemas.common import DataResponse, MetaResponse
from prism.memory.models import MemoryCreate, MemoryResponse, MemorySearchRequest, MemorySearchResult
from prism.memory.service import MemoryService
from prism.storage.postgres.database import get_db_session

router = APIRouter(prefix="/memory", tags=["memory"])


def get_memory_service(session: AsyncSession = Depends(get_db_session)) -> MemoryService:
    return MemoryService(session)


@router.post("", response_model=DataResponse[MemoryResponse], status_code=201)
async def create_memory(
    body: MemoryCreate,
    service: MemoryService = Depends(get_memory_service),
) -> DataResponse[MemoryResponse]:
    memory = await service.create(body)
    return DataResponse(data=memory, meta=MetaResponse(timestamp=datetime.now(UTC).isoformat()))


@router.get("/{memory_id}", response_model=DataResponse[MemoryResponse])
async def get_memory(
    memory_id: uuid.UUID,
    service: MemoryService = Depends(get_memory_service),
) -> DataResponse[MemoryResponse]:
    memory = await service.get(memory_id)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return DataResponse(data=memory, meta=MetaResponse(timestamp=datetime.now(UTC).isoformat()))


@router.post("/search", response_model=DataResponse[list[MemorySearchResult]])
async def search_memories(
    body: MemorySearchRequest,
    service: MemoryService = Depends(get_memory_service),
) -> DataResponse[list[MemorySearchResult]]:
    results = await service.search(body)
    return DataResponse(data=results, meta=MetaResponse(timestamp=datetime.now(UTC).isoformat()))


@router.delete("/{memory_id}", status_code=204)
async def delete_memory(
    memory_id: uuid.UUID,
    service: MemoryService = Depends(get_memory_service),
) -> None:
    deleted = await service.delete(memory_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")
