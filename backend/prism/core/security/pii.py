"""PII detection and masking before storage."""

import re
from typing import Pattern

EMAIL_PATTERN: Pattern[str] = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
)
PHONE_PATTERN: Pattern[str] = re.compile(
    r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"
)
TOKEN_PATTERN: Pattern[str] = re.compile(
    r"\b(?:sk-[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9._-]+)\b"
)
ADDRESS_PATTERN: Pattern[str] = re.compile(
    r"\b\d{1,5}\s+\w+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b",
    re.IGNORECASE,
)

_PATTERNS: list[tuple[Pattern[str], str]] = [
    (EMAIL_PATTERN, "[EMAIL_REDACTED]"),
    (PHONE_PATTERN, "[PHONE_REDACTED]"),
    (TOKEN_PATTERN, "[TOKEN_REDACTED]"),
    (ADDRESS_PATTERN, "[ADDRESS_REDACTED]"),
]


def mask_pii(text: str) -> str:
    """Mask common PII patterns in text before storage."""
    masked = text
    for pattern, replacement in _PATTERNS:
        masked = pattern.sub(replacement, masked)
    return masked
