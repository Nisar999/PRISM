"""Tests for deterministic semantic contradiction matching."""

import uuid

from prism.memory.healing.contradiction import (
    are_semantically_contradictory,
    find_contradictory_pair_among_ids,
    find_contradictory_pairs,
)

LIKES_PYTHON = "User likes Python."
DISLIKES_PYTHON = "User dislikes Python."
LIKES_PYTHON_ALT = "User likes Python programming language for backend development."
PREFERS_JS = "User prefers JavaScript instead of Python."
AVOIDS_JS = "User avoids JavaScript."
MARS = "User lives on Mars."


def test_likes_and_dislikes_python_are_contradictory() -> None:
    assert are_semantically_contradictory(LIKES_PYTHON, DISLIKES_PYTHON) is True


def test_two_likes_python_are_not_contradictory() -> None:
    assert are_semantically_contradictory(LIKES_PYTHON, LIKES_PYTHON_ALT) is False


def test_dislikes_does_not_trigger_likes_substring_false_positive() -> None:
    assert are_semantically_contradictory(DISLIKES_PYTHON, LIKES_PYTHON) is True
    assert are_semantically_contradictory(LIKES_PYTHON, LIKES_PYTHON) is False


def test_unrelated_memories_not_contradictory() -> None:
    assert are_semantically_contradictory(LIKES_PYTHON, MARS) is False


def test_prefers_avoids_contradiction() -> None:
    assert are_semantically_contradictory(PREFERS_JS, AVOIDS_JS) is True


def test_find_pairs_from_memory_list() -> None:
    likes_id = uuid.uuid4()
    dislikes_id = uuid.uuid4()
    likes_dup_id = uuid.uuid4()

    memories = [
        {"id": likes_id, "content": LIKES_PYTHON},
        {"id": dislikes_id, "content": DISLIKES_PYTHON},
        {"id": likes_dup_id, "content": LIKES_PYTHON_ALT},
    ]
    pairs = find_contradictory_pairs(memories)

    assert len(pairs) == 1
    pair_set = frozenset(pairs[0])
    assert pair_set == frozenset({likes_id, dislikes_id})


def test_find_validated_pair_among_candidate_ids() -> None:
    likes_id = uuid.uuid4()
    dislikes_id = uuid.uuid4()
    dup_id = uuid.uuid4()

    memory_by_id = {
        likes_id: LIKES_PYTHON,
        dislikes_id: DISLIKES_PYTHON,
        dup_id: LIKES_PYTHON_ALT,
    }
    # Parser may return UUIDs in prose order: two likes first, then dislike
    candidates = [dup_id, likes_id, dislikes_id]

    pair = find_contradictory_pair_among_ids(memory_by_id, candidates)

    assert pair is not None
    assert frozenset(pair) == frozenset({likes_id, dislikes_id})


def test_no_self_contradiction() -> None:
    memory_id = uuid.uuid4()
    memories = [{"id": memory_id, "content": LIKES_PYTHON}]
    assert find_contradictory_pairs(memories) == []
