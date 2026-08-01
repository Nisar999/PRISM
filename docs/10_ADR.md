> **Historical Design Document** — This document represents an earlier design phase of PRISM.
> For current architecture decisions, see [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md).

# Architecture Decision Records

Every major decision must be recorded.

Format:

ADR-XXX

Status

Context

Decision

Consequences

---

# ADR-001

Title

Why Qdrant?

---

Status

Accepted

---

Context

PRISM OS requires:

- Vector Search

- Fast Retrieval

- Open Source

- Docker Support

- Local First

---

Decision

Use:

Qdrant

---

Why

- Open Source

- Excellent filtering

- Payload support

- Fast

- Docker Friendly

- Active community

---

Consequences

Positive

- Local deployment

- No vendor lock-in

- Fast retrieval

Negative

- Manual scaling

---

# ADR-002

Title

Why Neo4j?

---

Status

Accepted

---

Context

PRISM OS requires:

Memory relationships

Contradictions

Reasoning chains

Thought trails

Knowledge graph

---

Decision

Use:

Neo4j Community Edition

---

Why

- Native graph model

- Cypher

- Visual graph exploration

- Docker Friendly

---

Consequences

Positive

- Natural graph structure

- Powerful relationships

Negative

- Another database to manage

---

# ADR-003

Title

Why LiteLLM?

---

Status

Accepted

---

Context

PRISM OS supports:

Ollama

LM Studio

OpenRouter

OpenAI

Anthropic

Gemini

---

Decision

Use:

LiteLLM

as abstraction layer.

---

Why

Single API.

Provider agnostic.

Easy fallback.

Open Source.

---

Consequences

Positive

Switch providers easily.

Negative

Additional abstraction layer.

---

# ADR-004

Title

Why Docker First?

---

Status

Accepted

---

Context

PRISM OS should run on:

Windows

Linux

MacOS

---

Decision

Everything runs through:

docker compose up

---

Why

Simple setup.

Portable.

Reproducible.

---

Consequences

Positive

One command setup.

Negative

Higher RAM usage.

---

# ADR-005

Title

Why Prism View?

---

Status

Accepted

---

Context

Traditional AI memory is invisible.

Users cannot:

Understand memory.

Understand trust.

See evolution.

---

Decision

Create:

Prism View

---

Purpose

Visualize:

Memory Types

Trust

Timeline

Decay

Growth

Failures

---

Consequences

Positive

Transparent AI.

Beautiful UX.

Negative

Complex visualization.

---

# ADR-006

Title

Why Globe View?

---

Status

Accepted

---

Context

Relationships are difficult to understand.

---

Decision

Create:

Globe View

---

Purpose

Visualize:

Memories

Sessions

Projects

Reasoning Chains

Contradictions

Healing

---

Consequences

Positive

Understand relationships.

Negative

Rendering complexity.

---

# ADR-007

Title

Why Thought View?

---

Status

Accepted

---

Context

Users cannot see:

How AI reasoned.

How memories were used.

Why answers were generated.

---

Decision

Create:

Thought View.

---

Scope

Session specific.

---

Visualize:

Planner

Retrieval

Reasoning

Reflection

Healing

Final Output

---

Consequences

Positive

Explainability.

Trust.

Negative

More storage required.

---

# ADR-008

Title

Why Mirror View?

---

Status

Accepted

---

Context

AI remembers users.

Users should know:

What AI knows.

What AI assumes.

What AI misunderstands.

---

Decision

Create:

Mirror View.

---

Purpose

Visualize:

Personality

Interests

Skills

Goals

Traits

Preferences

Contradictions

Confidence

---

Rules

Mirror never guesses.

Mirror stores:

Confirmed

or

High confidence information only.

---

Consequences

Positive

Trust.

Transparency.

Emotional connection.

Negative

Requires careful privacy controls.

---

# Final Principle

Every architecture decision

must answer:

Why?

Why not alternatives?

What are the tradeoffs?

What are the consequences?

PRISM remembers.

Engineers should too.