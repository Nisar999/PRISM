> **Historical Design Document** — This document represents an earlier design phase of PRISM.
> For the current architecture, see [ARCHITECTURE_V1.md](ARCHITECTURE_V1.md).

# Agents

Planner

Retrieval

Reasoning

Reflection

Trust Evaluator

Curator

---

Planner

Break tasks.

Choose memory strategy.

---

Retrieval

Retrieve:

Semantic

Procedural

Temporal

Failure

Episodic

---

Reasoning

Uses:

CoT

ReAct

Tool Calling

---

Reflection

Checks:

Hallucinations

Contradictions

Unsupported claims

Low trust memories

---

Trust Evaluator

Audits Reflection.

Avoids false positives.

---

Curator

Runs every 24h.

Tasks:

Archive

Merge duplicates

Apply decay

Compress memories

Promote important memories

Clean stale memories