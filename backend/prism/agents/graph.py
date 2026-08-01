"""LangGraph agent graph — orchestrates the full reasoning pipeline."""

from langgraph.graph import END, StateGraph

from prism.agents.curator.agent import CuratorAgent
from prism.agents.healing.agent import HealingAgent
from prism.agents.planner.agent import PlannerAgent
from prism.agents.reasoning.agent import ReasoningAgent
from prism.agents.reflection.agent import ReflectionAgent
from prism.agents.retrieval.agent import RetrievalAgent
from prism.agents.state import AgentState
from prism.agents.trust.agent import TrustEvaluatorAgent
from prism.core.logging import get_logger

logger = get_logger(__name__)


class AgentGraph:
    """LangGraph wiring Planner → Retrieval → Reasoning → Reflection → Trust → Healing."""

    def __init__(self, memory_service=None) -> None:
        self._memory_service = memory_service
        self._planner = PlannerAgent()
        self._retrieval = RetrievalAgent()
        self._reasoning = ReasoningAgent()
        self._reflection = ReflectionAgent()
        self._trust = TrustEvaluatorAgent()
        self._healing = HealingAgent()
        self._curator = CuratorAgent()
        self._graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        graph = StateGraph(AgentState)

        async def planner_node(state: AgentState) -> dict:
            return await self._planner.run(state)

        async def retrieval_node(state: AgentState) -> dict:
            return await self._retrieval.run(state, memory_service=self._memory_service)

        async def reasoning_node(state: AgentState) -> dict:
            return await self._reasoning.run(state)

        async def reflection_node(state: AgentState) -> dict:
            return await self._reflection.run(state)

        async def trust_node(state: AgentState) -> dict:
            return await self._trust.run(state)

        async def healing_node(state: AgentState) -> dict:
            return await self._healing.run(state, memory_service=self._memory_service)

        graph.add_node("planner", planner_node)
        graph.add_node("retrieval", retrieval_node)
        graph.add_node("reasoning", reasoning_node)
        graph.add_node("reflection", reflection_node)
        graph.add_node("trust", trust_node)
        graph.add_node("healing", healing_node)

        graph.set_entry_point("planner")
        graph.add_edge("planner", "retrieval")
        graph.add_edge("retrieval", "reasoning")
        graph.add_edge("reasoning", "reflection")
        graph.add_edge("reflection", "trust")
        graph.add_edge("trust", "healing")
        graph.add_edge("healing", END)

        return graph.compile()

    async def invoke(self, state: AgentState) -> AgentState:
        """Run the full agent pipeline."""
        logger.info("agent_graph_invoke", session_id=str(state.get("session_id")))
        result = await self._graph.ainvoke(state)
        return result

    @property
    def curator(self) -> CuratorAgent:
        return self._curator
