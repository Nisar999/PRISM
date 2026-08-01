> **Historical Design Document** — This document represents an earlier design phase of PRISM.
> For the current architecture, see [CONTRIBUTING.md](CONTRIBUTING.md).

# Coding Standards

PRISM OS follows strict engineering standards.

These rules are mandatory.

---

# General Principles

1.

Readability over cleverness.

Code is written for humans first.

---

2.

Prefer composition over inheritance.

---

3.

Every module must be independently testable.

---

4.

Every feature must be documented.

---

5.

Never tightly couple modules.

Use interfaces.

---

# Frontend Standards

Stack

- NextJS 15

- React 19

- TypeScript

- TailwindCSS

- shadcn/ui

- React Three Fiber

- ThreeJS

---

Rules

Use:

Functional Components

Hooks

Server Components when possible

Client Components only when needed

---

Avoid:

Class Components

Inline CSS

Prop drilling

Global mutable state

---

State Management

Use:

- Zustand

- Tanstack Query

---

Never:

Use Redux.

---

Folder Structure

Feature First.

Example:

features/

chat/

components/

hooks/

store/

types/

api/

---

Naming

Components:

PascalCase

Example:

ChatWindow.tsx

PrismView.tsx

MirrorPanel.tsx

---

Hooks:

camelCase

Example:

useChat.ts

useMemory.ts

---

Files:

kebab-case

Example:

thought-trail.tsx

memory-card.tsx

---

# Backend Standards

Stack

- FastAPI

- LangGraph

- Pydantic

- SQLAlchemy

---

Rules

Every route:

- Request Model

- Response Model

- Validation

- Error Handling

---

Never:

Return raw dicts.

---

Use:

Pydantic Models

for

everything.

---

Async First

Use:

async

await

for:

API

Database

LLM Calls

Workers

---

Never:

Block event loop.

---

# Database Standards

Use:

PostgreSQL

Neo4j

Qdrant

Redis

---

Never:

Query DB directly from routes.

---

Always:

Route

↓

Service

↓

Repository

↓

Database

---

Use:

UUID

for IDs.

---

Every table requires:

created_at

updated_at

deleted_at

---

Soft delete preferred.

---

# API Standards

Use:

REST

SSE

WebSockets

---

Never:

Use polling if streaming possible.

---

Every endpoint:

Must have:

Request schema

Response schema

Validation

Examples

OpenAPI docs

---

Versioning

Use:

/api/v1/

Example

/api/v1/chat

/api/v1/memory

/api/v1/provider

---

# LLM Standards

Use:

LiteLLM

as abstraction.

---

Never:

Call provider SDKs directly.

---

Support:

Ollama

LM Studio

OpenRouter

OpenAI

Anthropic

Gemini

---

All providers must implement:

chat()

stream()

embed()

vision()

tools()

health()

models()

---

# Memory Standards

Memory Types:

EPISODIC

SEMANTIC

PROCEDURAL

TEMPORAL

FAILURE

---

Never:

Mix memory types.

---

Every memory stores:

id

session_id

type

content

trust

mem_score

created_at

updated_at

metadata

---

FAILURE memories

Never decay.

Never delete automatically.

---

TEMPORAL memories

Can expire.

---

# Visual Cognition Standards

Views:

Prism

Globe

Thought

Mirror

---

Animations:

Use:

Framer Motion

GSAP

React Three Fiber

---

Avoid:

Heavy particle effects

Overdraw

Unnecessary shaders

---

Must support:

60fps

on mid-range hardware.

---

# Security Standards

Never:

Store API Keys in code.

---

Use:

.env

Docker Secrets

---

Never:

Store PII unencrypted.

---

Always:

Mask

Email

Phone

Tokens

Addresses

Before storage.

---

# Testing Standards

Every feature requires:

Unit Tests

Integration Tests

---

Critical flows require:

E2E Tests

---

Minimum coverage:

80%

---

Use:

Pytest

Vitest

Playwright

---

# Git Standards

Branch Names:

feature/chat

feature/prism-view

feature/memory-engine

fix/provider-fallback

---

Commit Format

feat:

fix:

docs:

refactor:

test:

perf:

---

Example

feat:

add prism view memory renderer

---

# Final Rule

Readable code

>

Smart code

Always.