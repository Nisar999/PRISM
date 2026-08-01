> **Historical Design Document** — This document represents an earlier design phase of PRISM.
> For the current architecture, see [ARCHITECTURE_V1.md](ARCHITECTURE_V1.md).

# Architecture

PRISM OS uses six layers.

---

Tier 0

VISUAL COGNITION

---

Contains:

Prism View

Globe View

Timeline

Thought Trails

Contradiction Graph

---

Tier 1

WORKSPACE

---

Contains:

Chat

Files

Projects

Browser

Terminal

GitHub

Research

---

Tier 2

AGENTS

---

Planner

Retrieval

Reasoning

Reflection

Trust Evaluator

Curator

---

Tier 3

MEMORY

---

Classifier

MemScore

Adaptive Retrieval

Self Healing

Memory Curation

---

Tier 4

STORAGE

---

Qdrant

Neo4j

PostgreSQL

Redis

---

Tier 5

LLMs

---

Ollama

LM Studio

OpenRouter

OpenAI

Anthropic

Gemini

---

Flow

User

↓

Workspace

↓

Planner

↓

Memory

↓

Retrieval

↓

Reasoning

↓

Reflection

↓

Healing

↓

Visualization

↓

Answer

---

Everything is modular.

Every layer can be replaced independently.

No layer depends directly on UI.