"""Tests for PII masking."""

from prism.core.security.pii import mask_pii


def test_mask_email() -> None:
    result = mask_pii("Contact me at user@example.com please")
    assert "user@example.com" not in result
    assert "[EMAIL_REDACTED]" in result


def test_mask_phone() -> None:
    result = mask_pii("Call me at 555-123-4567")
    assert "555-123-4567" not in result
    assert "[PHONE_REDACTED]" in result


def test_no_pii_unchanged() -> None:
    text = "PRISM OS remembers and reasons"
    assert mask_pii(text) == text
