"""Tests for MemScore."""

from datetime import UTC, datetime

import pytest

from prism.memory.models import MemoryType
from prism.memory.scorer.mem_score import MemScorer


@pytest.fixture
def scorer() -> MemScorer:
    return MemScorer()


def test_compute_score_range(scorer: MemScorer) -> None:
    score = scorer.compute(
        memory_type=MemoryType.SEMANTIC,
        trust=0.8,
        created_at=datetime.now(UTC),
    )
    assert 0.0 <= score <= 1.0


def test_failure_never_decays(scorer: MemScorer) -> None:
    score = scorer.apply_decay(0.9, MemoryType.FAILURE, days_since_access=365)
    assert score == 0.9


def test_episodic_decays(scorer: MemScorer) -> None:
    score = scorer.apply_decay(1.0, MemoryType.EPISODIC, days_since_access=100)
    assert score < 1.0
