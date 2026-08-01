"""MemScore — composite memory importance scoring."""

from datetime import UTC, datetime

from prism.memory.models import MemoryType

# Weights for MemScore components
WEIGHTS = {
    "recency": 0.25,
    "frequency": 0.20,
    "trust": 0.30,
    "type_importance": 0.15,
    "connection_count": 0.10,
}

TYPE_IMPORTANCE: dict[MemoryType, float] = {
    MemoryType.FAILURE: 1.0,
    MemoryType.PROCEDURAL: 0.9,
    MemoryType.SEMANTIC: 0.8,
    MemoryType.TEMPORAL: 0.7,
    MemoryType.EPISODIC: 0.6,
}


class MemScorer:
    """Calculates composite MemScore for memory ranking and curation."""

    def compute(
        self,
        memory_type: MemoryType,
        trust: float,
        created_at: datetime,
        access_count: int = 0,
        connection_count: int = 0,
    ) -> float:
        """Compute MemScore in range [0.0, 1.0]."""
        now = datetime.now(UTC)
        age_days = max((now - created_at.replace(tzinfo=UTC if created_at.tzinfo is None else created_at.tzinfo)).days, 0)
        recency = max(0.0, 1.0 - (age_days / 365.0))
        frequency = min(1.0, access_count / 10.0)
        type_score = TYPE_IMPORTANCE.get(memory_type, 0.5)
        connection_score = min(1.0, connection_count / 5.0)

        score = (
            WEIGHTS["recency"] * recency
            + WEIGHTS["frequency"] * frequency
            + WEIGHTS["trust"] * trust
            + WEIGHTS["type_importance"] * type_score
            + WEIGHTS["connection_count"] * connection_score
        )
        return round(min(1.0, max(0.0, score)), 4)

    def apply_decay(
        self,
        current_score: float,
        memory_type: MemoryType,
        days_since_access: int,
    ) -> float:
        """Apply time-based decay. FAILURE memories never decay."""
        from prism.memory.models import DECAY_RATES

        rate = DECAY_RATES.get(memory_type)
        if rate is None:
            return current_score

        decay_factor = max(0.0, 1.0 - (rate * days_since_access))
        return round(current_score * decay_factor, 4)
