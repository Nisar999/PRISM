# PRISM Pull Request Template

## Summary
Briefly describe what this PR changes and why.

## Type of change
- [ ] Bug fix (non-breaking)
- [ ] New feature / improvement (non-breaking)
- [ ] Refactor (no behavior change)
- [ ] Docs / repo hygiene
- [ ] Breaking change

## Architecture impact
PRISM's architecture is **frozen** (see `docs/ARCHITECTURE_FREEZE.md`).
Does this PR touch any frozen surface?
- [ ] No — changes are additive or implementation-only.
- [ ] Yes — I have documented the deviation and linked the governing ADR.

## Verification
- [ ] `npm run build` (desktop) passes
- [ ] `ruff check prism tests` (backend) passes
- [ ] `pytest tests/` (backend) passes
- [ ] Manually verified the affected flow

## Notes for reviewers
Anything reviewers should pay attention to, risky areas, or follow-ups.
