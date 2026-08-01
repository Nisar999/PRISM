"""Tests for memory classifier."""

import pytest

from prism.memory.classifier.classifier import MemoryClassifier
from prism.memory.models import MemoryType


@pytest.fixture
def classifier() -> MemoryClassifier:
    return MemoryClassifier(llm=None)


def test_classify_failure(classifier: MemoryClassifier) -> None:
    result = classifier.classify_heuristic("The deployment failed with an error")
    assert result == MemoryType.FAILURE


def test_classify_procedural(classifier: MemoryClassifier) -> None:
    result = classifier.classify_heuristic("How to install Docker step by step")
    assert result == MemoryType.PROCEDURAL


def test_classify_semantic_default(classifier: MemoryClassifier) -> None:
    result = classifier.classify_heuristic(
        "Python is a high-level programming language used for web development"
    )
    assert result == MemoryType.SEMANTIC
