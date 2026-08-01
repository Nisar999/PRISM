"""Memory type classifier — assigns content to one of five memory layers."""

import re

from prism.memory.models import MemoryType
from prism.providers.interface import ChatMessage, ChatRequest, LLMProvider

CLASSIFIER_PROMPT = """Classify the following content into exactly ONE memory type:

- EPISODIC: Personal experiences, sessions, conversations, events
- SEMANTIC: Facts, knowledge, definitions, concepts
- PROCEDURAL: Skills, workflows, how-to instructions, processes
- TEMPORAL: Current, time-sensitive, expiring information
- FAILURE: Mistakes, errors, failures, things that went wrong

Respond with ONLY the type name in lowercase (e.g., "semantic").

Content: {content}"""

# Keyword heuristics for fast classification without LLM
KEYWORD_RULES: dict[MemoryType, list[str]] = {
    MemoryType.FAILURE: ["failed", "error", "mistake", "wrong", "bug", "crash", "broken"],
    MemoryType.PROCEDURAL: ["how to", "step", "workflow", "process", "install", "configure"],
    MemoryType.TEMPORAL: ["today", "now", "current", "deadline", "expires", "temporary"],
    MemoryType.SEMANTIC: ["is a", "defined as", "means", "fact", "concept", "definition"],
    MemoryType.EPISODIC: ["remember when", "we discussed", "session", "conversation", "experience"],
}


class MemoryClassifier:
    """Classifies content into memory types using heuristics + optional LLM."""

    def __init__(self, llm: LLMProvider | None = None) -> None:
        self._llm = llm

    def classify_heuristic(self, content: str) -> MemoryType:
        """Fast keyword-based classification."""
        lower = content.lower()
        scores: dict[MemoryType, int] = {t: 0 for t in MemoryType}

        for memory_type, keywords in KEYWORD_RULES.items():
            for keyword in keywords:
                if keyword in lower:
                    scores[memory_type] += 1

        best = max(scores, key=lambda t: scores[t])
        if scores[best] > 0:
            return best

        # Default: episodic for conversational content, semantic for factual
        if "?" in content or len(content.split()) < 20:
            return MemoryType.EPISODIC
        return MemoryType.SEMANTIC

    async def classify(self, content: str) -> MemoryType:
        """Classify using LLM when available, fallback to heuristics."""
        if self._llm is None:
            return self.classify_heuristic(content)

        try:
            request = ChatRequest(
                messages=[
                    ChatMessage(role="user", content=CLASSIFIER_PROMPT.format(content=content[:500]))
                ],
                temperature=0.0,
                max_tokens=10,
            )
            response = await self._llm.chat(request)
            result = response.content.strip().lower()
            result = re.sub(r"[^a-z]", "", result)
            return MemoryType(result)
        except (ValueError, Exception):
            return self.classify_heuristic(content)
