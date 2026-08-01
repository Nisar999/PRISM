"""Agent execution endpoints."""

import json
import uuid
from datetime import UTC, datetime
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from prism.agents.graph import AgentGraph
from prism.agents.state import AgentState
from prism.api.schemas.common import DataResponse, MetaResponse
from prism.core.logging import get_logger
from prism.memory.service import MemoryService
from prism.storage.postgres.database import get_db_session

logger = get_logger(__name__)

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentInvokeRequest(BaseModel):
    message: str = Field(min_length=1)
    session_id: uuid.UUID | None = None
    provider: str | None = None
    model: str | None = None
    api_key: str | None = None
    # Discovered local base URL (Ollama / LM Studio / OpenAI-compat) from desktop.
    endpoint: str | None = None


class AgentInvokeResponse(BaseModel):
    final_answer: str | None
    plan: str | None
    reasoning: str | None
    reflection: str | None
    trust_score: float
    retrieved_memories: list[dict]
    healing_actions: list[dict]
    errors: list[str]


def _build_initial_state(body: AgentInvokeRequest) -> AgentState:
    metadata: dict = {}
    if body.provider:
        metadata["provider"] = body.provider
    if body.model:
        metadata["model"] = body.model
    if body.api_key:
        metadata["api_key"] = body.api_key
    if body.endpoint:
        metadata["endpoint"] = body.endpoint
    return {
        "messages": [HumanMessage(content=body.message)],
        "session_id": body.session_id,
        "plan": None,
        "retrieved_memories": [],
        "reasoning": None,
        "reflection": None,
        "trust_score": 0.0,
        "healing_actions": [],
        "final_answer": None,
        "errors": [],
        "metadata": metadata,
    }


@router.post("/invoke", response_model=DataResponse[AgentInvokeResponse])
async def invoke_agent(
    body: AgentInvokeRequest,
    session: AsyncSession = Depends(get_db_session),
) -> DataResponse[AgentInvokeResponse]:
    memory_service = MemoryService(session)
    graph = AgentGraph(memory_service=memory_service)

    initial_state = _build_initial_state(body)
    result = await graph.invoke(initial_state)

    response = AgentInvokeResponse(
        final_answer=result.get("final_answer"),
        plan=result.get("plan"),
        reasoning=result.get("reasoning"),
        reflection=result.get("reflection"),
        trust_score=result.get("trust_score", 0.0),
        retrieved_memories=result.get("retrieved_memories", []),
        healing_actions=result.get("healing_actions", []),
        errors=result.get("errors", []),
    )

    return DataResponse(data=response, meta=MetaResponse(timestamp=datetime.now(UTC).isoformat()))


def _sse_event(event: str, data: dict) -> str:
    """Format a single Server-Sent Event frame."""
    payload = json.dumps(data, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


async def _stream_agent_events(
    body: AgentInvokeRequest,
    session: AsyncSession,
) -> AsyncIterator[str]:
    """Yield SSE frames as the LangGraph pipeline progresses.

    Event types:
      - `node_started`  {node}
      - `node_updated`  {node, state}
      - `final`         {response: AgentInvokeResponse}
      - `error`         {message}
    """
    memory_service = MemoryService(session)
    graph = AgentGraph(memory_service=memory_service)
    initial_state = _build_initial_state(body)

    yield _sse_event("session_started", {"session_id": str(body.session_id) if body.session_id else None})

    final_state: AgentState = {}
    try:
        # LangGraph stream_mode="updates" yields {node_name: update_dict} per step.
        async for update in graph._graph.astream(initial_state, stream_mode="updates"):
            if not isinstance(update, dict):
                continue
            for node_name, chunk in update.items():
                yield _sse_event("node_started", {"node": node_name})
                if isinstance(chunk, dict):
                    final_state.update(chunk)
                    incremental = {
                        k: chunk.get(k)
                        for k in ("plan", "reasoning", "reflection", "final_answer", "trust_score")
                        if k in chunk
                    }
                    if incremental:
                        yield _sse_event("node_updated", {"node": node_name, "state": incremental})
    except Exception as exc:  # noqa: BLE001
        logger.exception("agent_stream_failed")
        yield _sse_event("error", {"message": str(exc)})
        return

    response = AgentInvokeResponse(
        final_answer=final_state.get("final_answer"),
        plan=final_state.get("plan"),
        reasoning=final_state.get("reasoning"),
        reflection=final_state.get("reflection"),
        trust_score=final_state.get("trust_score", 0.0),
        retrieved_memories=final_state.get("retrieved_memories", []),
        healing_actions=final_state.get("healing_actions", []),
        errors=final_state.get("errors", []),
    )
    yield _sse_event("final", {"response": response.model_dump()})


@router.post("/stream")
async def stream_agent(
    body: AgentInvokeRequest,
    session: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    """Stream agent pipeline updates as Server-Sent Events."""
    return StreamingResponse(
        _stream_agent_events(body, session),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
