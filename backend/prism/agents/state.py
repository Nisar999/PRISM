"""Agent state schema for LangGraph."""

import uuid
from typing import Annotated, Any, TypedDict

from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """Shared state flowing through the agent graph."""

    messages: Annotated[list, add_messages]
    session_id: uuid.UUID | None
    plan: str | None
    retrieved_memories: list[dict]
    reasoning: str | None
    reflection: str | None
    trust_score: float
    healing_actions: list[dict]
    final_answer: str | None
    errors: list[str]
    metadata: dict[str, Any]
