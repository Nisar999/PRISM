"""Deterministic semantic contradiction detection for memory pairing."""

import re
import uuid
from typing import Literal

Polarity = Literal["positive", "negative", "affirmative", "denial", "working", "broken"]

# (positive_pattern, negative_pattern) — matched with word boundaries
POLARITY_PAIRS: list[tuple[re.Pattern[str], re.Pattern[str], str]] = [
    (re.compile(r"\blikes?\b"), re.compile(r"\bdislikes?\b"), "preference"),
    (re.compile(r"\bprefers?\b"), re.compile(r"\bavoids?\b"), "preference"),
    (re.compile(r"\bsupports?\b"), re.compile(r"\bopposes?\b"), "stance"),
    (re.compile(r"\btrue\b"), re.compile(r"\bfalse\b"), "boolean"),
    (re.compile(r"\bworks?\b"), re.compile(r"\bbroken\b"), "status"),
    (re.compile(r"\benjoys?\b"), re.compile(r"\bhates?\b"), "preference"),
    (re.compile(r"\buses?\b"), re.compile(r"\brefuses?\b"), "action"),
]

STOPWORDS = frozenset(
    {
        "user",
        "the",
        "a",
        "an",
        "and",
        "or",
        "to",
        "for",
        "of",
        "in",
        "on",
        "at",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "that",
        "this",
        "with",
        "from",
        "instead",
        "rather",
        "programming",
        "language",
        "instead",
    }
)


def _detect_polarity(content: str) -> tuple[Polarity | None, str | None]:
    """Return polarity side and category label for a memory statement."""
    text = content.lower().strip()

    for pos_pat, neg_pat, category in POLARITY_PAIRS:
        pos_match = bool(pos_pat.search(text))
        neg_match = bool(neg_pat.search(text))
        if pos_match and neg_match:
            return None, None
        if neg_match:
            return "negative", category
        if pos_match:
            return "positive", category

    if re.search(r"\bfalse\b", text):
        return "denial", "boolean"
    if re.search(r"\btrue\b", text):
        return "affirmative", "boolean"
    if re.search(r"\bbroken\b", text):
        return "broken", "status"
    if re.search(r"\bworks?\b", text) and not re.search(r"\bbroken\b", text):
        return "working", "status"

    return None, None


def _extract_topic_tokens(content: str) -> set[str]:
    """Extract meaningful topic tokens shared between memories."""
    text = content.lower()
    for pos_pat, neg_pat, _ in POLARITY_PAIRS:
        text = pos_pat.sub(" ", text)
        text = neg_pat.sub(" ", text)
    text = re.sub(r"[^\w\s]", " ", text)
    tokens = {
        token
        for token in text.split()
        if len(token) > 2 and token not in STOPWORDS and not token.isdigit()
    }
    return tokens


def are_semantically_contradictory(content_a: str, content_b: str) -> bool:
    """Return True when two statements express opposing polarity on overlapping topics."""
    if not content_a or not content_b:
        return False
    if content_a.strip().lower() == content_b.strip().lower():
        return False

    pol_a, cat_a = _detect_polarity(content_a)
    pol_b, cat_b = _detect_polarity(content_b)
    if pol_a is None or pol_b is None:
        return False

    opposing_groups: list[frozenset[str]] = [
        frozenset({"positive", "negative"}),
        frozenset({"affirmative", "denial"}),
        frozenset({"working", "broken"}),
    ]
    if not any({pol_a, pol_b} <= group for group in opposing_groups):
        return False

    if cat_a and cat_b and cat_a != cat_b:
        return False

    tokens_a = _extract_topic_tokens(content_a)
    tokens_b = _extract_topic_tokens(content_b)
    if not tokens_a or not tokens_b:
        return False

    return bool(tokens_a & tokens_b)


def find_contradictory_pairs(
    memories: list[dict],
) -> list[tuple[uuid.UUID, uuid.UUID]]:
    """Find all semantically opposing memory pairs from memory dicts with id + content."""
    valid = [m for m in memories if m.get("id") and m.get("content")]
    pairs: list[tuple[uuid.UUID, uuid.UUID]] = []
    seen: set[frozenset[uuid.UUID]] = set()

    for i, left in enumerate(valid):
        left_id = uuid.UUID(str(left["id"]))
        left_content = str(left["content"])
        for right in valid[i + 1 :]:
            right_id = uuid.UUID(str(right["id"]))
            if left_id == right_id:
                continue
            right_content = str(right["content"])
            if not are_semantically_contradictory(left_content, right_content):
                continue
            key = frozenset({left_id, right_id})
            if key in seen:
                continue
            seen.add(key)
            pairs.append((left_id, right_id))

    return pairs


def find_contradictory_pair_among_ids(
    memory_by_id: dict[uuid.UUID, str],
    candidate_ids: list[uuid.UUID],
) -> tuple[uuid.UUID, uuid.UUID] | None:
    """Pick the best validated contradictory pair from candidate memory IDs."""
    ids = list(dict.fromkeys(candidate_ids))
    for i, id_a in enumerate(ids):
        content_a = memory_by_id.get(id_a)
        if not content_a:
            continue
        for id_b in ids[i + 1 :]:
            content_b = memory_by_id.get(id_b)
            if not content_b:
                continue
            if are_semantically_contradictory(content_a, content_b):
                return id_a, id_b
    return None


def memories_from_retrieved(retrieved_memories: list[dict]) -> list[dict]:
    """Normalize agent retrieval results into {id, content} dicts."""
    return [
        {
            "id": item["memory"]["id"],
            "content": item["memory"].get("content", ""),
        }
        for item in retrieved_memories
        if item.get("memory", {}).get("id")
    ]
