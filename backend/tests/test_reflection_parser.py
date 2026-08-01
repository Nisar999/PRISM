"""Tests for reflection output parsing."""

import uuid

from prism.agents.reflection.parser import parse_reflection

MEMORY_A = "26b5a520-db15-4a2f-b315-9d8e531dbfe2"
MEMORY_B = "707e9694-dd90-4859-9e14-068d8edfdac5"


def test_parse_reflection_json_with_contradiction() -> None:
    content = f"""{{
  "passed": false,
  "issues": [
    {{
      "issue_type": "Contradiction",
      "description": "Memory {MEMORY_A} likes Python but {MEMORY_B} dislikes Python."
    }}
  ],
  "confidence": 0.4,
  "recommendation": "reject"
}}"""
    parsed = parse_reflection(content)

    assert parsed["raw_parsed"] is True
    assert parsed["recommendation"] == "reject"
    assert len(parsed["issues"]) == 1
    assert parsed["issues"][0]["issue_type"] == "contradiction"
    assert uuid.UUID(MEMORY_A) in [uuid.UUID(mid) for mid in parsed["issues"][0]["memory_ids"]]
    assert uuid.UUID(MEMORY_B) in [uuid.UUID(mid) for mid in parsed["issues"][0]["memory_ids"]]


def test_parse_reflection_code_fence() -> None:
    content = f"""Here is the JSON response:

```json
{{
  "passed": false,
  "issues": [{{"issue_type": "Hallucination", "description": "Unsupported claim in {MEMORY_A}."}}],
  "confidence": 0.2,
  "recommendation": "revise"
}}
```"""
    parsed = parse_reflection(content)

    assert parsed["raw_parsed"] is True
    assert parsed["issues"][0]["issue_type"] == "hallucination"
    assert parsed["issues"][0]["memory_ids"] == [MEMORY_A]


def test_parse_reflection_fallback_contradiction_ids() -> None:
    content = (
        f"Contradiction detected between memory {MEMORY_A} and memory {MEMORY_B}."
    )
    parsed = parse_reflection(content)

    assert parsed["issues"]
    assert parsed["issues"][0]["issue_type"] == "contradiction"
    assert len(parsed["issues"][0]["memory_ids"]) >= 2
