"""Curator agent — scheduled memory maintenance (archive, merge, decay, promote)."""

from datetime import UTC, datetime

from prism.core.logging import get_logger
from prism.memory.models import DECAY_RATES, MemoryType
from prism.memory.scorer.mem_score import MemScorer

logger = get_logger(__name__)


class CuratorAgent:
    """Runs periodic memory curation tasks every 24h via Celery worker."""

    def __init__(self) -> None:
        self._scorer = MemScorer()

    async def run_archive(self, stale_days: int = 90) -> dict:
        """Archive low-score episodic memories older than threshold."""
        logger.info("curator_archive_start", stale_days=stale_days)
        return {"archived_count": 0, "stale_days": stale_days}

    async def run_merge_duplicates(self) -> dict:
        """Merge duplicate semantic memories."""
        logger.info("curator_merge_start")
        return {"merged_count": 0}

    async def run_decay(self, memories: list[dict]) -> dict:
        """Apply decay to non-FAILURE memories."""
        decayed = 0
        for memory in memories:
            memory_type = MemoryType(memory["memory_type"])
            if DECAY_RATES.get(memory_type) is None:
                continue
            new_score = self._scorer.apply_decay(
                memory["mem_score"],
                memory_type,
                days_since_access=memory.get("days_since_access", 1),
            )
            if new_score != memory["mem_score"]:
                decayed += 1
        logger.info("curator_decay_complete", decayed=decayed)
        return {"decayed_count": decayed}

    async def run_promote(self, memories: list[dict], threshold: float = 0.8) -> dict:
        """Promote high-score memories."""
        promoted = [m for m in memories if m.get("mem_score", 0) >= threshold]
        logger.info("curator_promote_complete", promoted=len(promoted))
        return {"promoted_count": len(promoted)}

    async def run_full_curation(self) -> dict:
        """Execute all curation tasks."""
        logger.info("curator_full_run", timestamp=datetime.now(UTC).isoformat())
        archive = await self.run_archive()
        merge = await self.run_merge_duplicates()
        return {
            "archive": archive,
            "merge": merge,
            "completed_at": datetime.now(UTC).isoformat(),
        }
