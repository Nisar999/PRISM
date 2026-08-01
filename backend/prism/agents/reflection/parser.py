"""Parse Reflection agent LLM output into structured healing issues."""

import json
import re
import uuid
from typing import Any

UUID_PATTERN = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)


def _normalize_issue_type(raw: str) -> str:
    lowered = raw.lower().replace(" ", "_")
    if "contradict" in lowered:
        return "contradiction"
    if "hallucin" in lowered:
        return "hallucination"
    if "unsupported" in lowered:
        return "unsupported_claim"
    if "low_trust" in lowered or "low_confidence" in lowered or "low trust" in raw.lower():
        return "low_confidence"
    return lowered


def _extract_json_blob(content: str) -> dict[str, Any] | None:
    if not content:
        return None

    stripped = content.strip()
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, re.DOTALL)
    if fence_match:
        try:
            parsed = json.loads(fence_match.group(1))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    brace_match = re.search(r"\{.*\}", stripped, re.DOTALL)
    if brace_match:
        try:
            parsed = json.loads(brace_match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    return None


def _extract_memory_ids(*texts: str | None) -> list[uuid.UUID]:
    seen: set[uuid.UUID] = set()
    ordered: list[uuid.UUID] = []
    for text in texts:
        if not text:
            continue
        for match in UUID_PATTERN.findall(text):
            try:
                memory_id = uuid.UUID(match)
            except ValueError:
                continue
            if memory_id not in seen:
                seen.add(memory_id)
                ordered.append(memory_id)
    return ordered


def _parse_issue_entry(entry: Any) -> dict[str, Any] | None:
    if isinstance(entry, str):
        return {
            "issue_type": _normalize_issue_type(entry),
            "description": entry,
            "memory_ids": _extract_memory_ids(entry),
            "confidence": None,
        }

    if not isinstance(entry, dict):
        return None

    raw_type = str(entry.get("issue_type") or entry.get("type") or "unknown")
    description = str(entry.get("description") or entry.get("message") or raw_type)
    memory_ids = _extract_memory_ids(
        description,
        str(entry.get("memory_id", "")),
        str(entry.get("memory_ids", "")),
        json.dumps(entry.get("memory_ids", [])) if entry.get("memory_ids") else None,
    )
    if entry.get("memory_id"):
        memory_ids = _extract_memory_ids(str(entry["memory_id"]), description) or memory_ids

    confidence = entry.get("confidence")
    if confidence is not None:
        try:
            confidence = float(confidence)
        except (TypeError, ValueError):
            confidence = None

    return {
        "issue_type": _normalize_issue_type(raw_type),
        "description": description,
        "memory_ids": [str(mid) for mid in memory_ids],
        "confidence": confidence,
    }


def parse_reflection(content: str | None) -> dict[str, Any]:
    """Convert reflection text into structured issues for the Healing agent."""
    result: dict[str, Any] = {
        "passed": False,
        "recommendation": "reject",
        "confidence": 0.0,
        "issues": [],
        "raw_parsed": False,
    }
    if not content:
        return result

    blob = _extract_json_blob(content)
    if blob:
        result["raw_parsed"] = True
        result["passed"] = bool(blob.get("passed", False))
        result["recommendation"] = str(blob.get("recommendation", "reject")).lower()
        try:
            result["confidence"] = float(blob.get("confidence", 0.0))
        except (TypeError, ValueError):
            result["confidence"] = 0.0

        for entry in blob.get("issues", []):
            issue = _parse_issue_entry(entry)
            if issue:
                result["issues"].append(issue)
    else:
        lowered = content.lower()
        if "contradict" in lowered:
            result["issues"].append(
                {
                    "issue_type": "contradiction",
                    "description": content[:500],
                    "memory_ids": [str(mid) for mid in _extract_memory_ids(content)],
                    "confidence": None,
                }
            )
        if "hallucin" in lowered:
            result["issues"].append(
                {
                    "issue_type": "hallucination",
                    "description": content[:500],
                    "memory_ids": [str(mid) for mid in _extract_memory_ids(content)],
                    "confidence": None,
                }
            )

    if not result["issues"]:
        fallback_ids = _extract_memory_ids(content)
        if "contradict" in content.lower() and len(fallback_ids) >= 2:
            result["issues"].append(
                {
                    "issue_type": "contradiction",
                    "description": "Contradiction detected in reflection output.",
                    "memory_ids": [str(mid) for mid in fallback_ids],
                    "confidence": None,
                }
            )

    return result
