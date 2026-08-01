# PRISM Product Constitution

**Status:** Locked  
**Authority:** Permanent product canon  
**Supersedes:** Older product-identity assumptions in historical docs, marketing mockups, and informal IDE framing  
**Architecture:** Unchanged — this constitution governs product identity and scope, not system redesign

This document is the permanent product constitution for PRISM. When product language conflicts with older materials, **this document wins**. Architecture remains frozen per `ARCHITECTURE_FREEZE.md`.

---

## 1. Vision

Create an AI that:

- remembers permanently
- reasons transparently
- heals itself
- evolves with the user

Not for a session. For years.

**Guiding line:** Experience enters. PRISM refracts it. Memory becomes intelligence. Intelligence becomes evolution.

---

## 2. Product Identity

**PRISM is an Agentic Intelligent Workspace.**

PRISM is the product. Interfaces and editing engines are shapes of that product — not the product itself.

### Locked hierarchy

```
PRISM Desktop
    ├── Dashboard
    ├── Milly
    ├── Memory
    ├── Thoughts
    ├── Planning
    ├── Execution
    ├── Workspace
    └── VS Code Editor
```

**Not:**

```
VS Code
    + PRISM
```

---

## 3. Product Philosophy

### One Mind. Infinite Shapes.

One cognitive mind. Many surfaces. The mind does not change when the shape changes.

### PRISM owns intelligence. Interfaces own experience.

PRISM owns reasoning, memory, planning, reflection, trust, tools, execution, identity, workspace, Milly, and application lifecycle.

Interfaces render state, accept intent, and present experience. They do not own business intelligence.

### Local-first

Users own memories, models, files, graphs, and workspace state. Offline-capable local operation is baseline. Cloud is optional.

### Provider-independent

Models and vendors are pluggable execution details. Never hardcode the product to a single LLM vendor.

### Memory-first

Every durable interaction becomes experience. Memory is a first-class subsystem, not a chat log afterthought.

### Reason before execution

Intent → planning → routing → tool orchestration → execution. Tools do not run before the system has reasoned.

### Integrate instead of rebuild

Reuse proven editing and IDE engines for code UX. Do not fork or reimplement Monaco, explorer, search, git, terminal, debugger, or extension hosts as PRISM core.

---

## 4. What PRISM Is

PRISM is:

- an **Agentic Intelligent Workspace**
- the owner of cognitive lifecycle and long-lived memory
- a modular, local-first, provider-independent system
- the product shell in which editing engines may be embedded
- transparent about planning, execution, reflection, and trust

### PRISM owns

| Domain | Meaning |
|--------|---------|
| Intelligence | Cognitive pipeline and agent reasoning |
| Memory | Episodic, Semantic, Procedural, Temporal, Failure |
| Planning | Goals, strategies, plans, re-planning |
| Reflection | Post-action analysis and critique |
| Trust | Reliability scoring and audit of reasoning |
| Tool Runtime | Tool planning, lifecycle, logging |
| Execution Runtime | Session lifecycle, retry, pause/resume |
| Identity | Local-first profiles and preferences |
| Workspace | Project / Session / Artifact model |
| Milly | Cognitive presence visualization |
| Application lifecycle | Boot, sync, persistence, shutdown |

---

## 5. What PRISM Is Not

PRISM is **NOT**:

- a fork of VS Code
- a ChatGPT clone
- another AI IDE
- a chatbot-default messenger product
- a RAG wrapper with a pretty UI
- a vendor-locked cloud assistant

### VS Code owns (as Editing Engine)

When embedded, VS Code (or Code-OSS) owns:

- Code editing
- Monaco
- Explorer
- Search
- Git
- Terminal
- Debugger
- Extensions
- Editor UX

**VS Code is an EDITING ENGINE.**  
**PRISM is the PRODUCT.**

---

## 6. Milly

Milly is the **cognitive presence of PRISM**.

- Milly visualizes kernel state (planning, executing, reflecting, healing, idle, …)
- Milly is **not** a character, mascot, or chatbot companion
- **v1:** Milly has **no voice**
- **v2:** Milly may gain **optional** voice (and broader desktop automation belongs to the v2 ADE phase)

---

## 7. Roadmap (Locked)

| Phase | Product form | Notes |
|-------|----------------|-------|
| **v1** | Agentic Intelligent Workspace | Full PRISM product surfaces; VS Code as editing engine; **Milly has no voice** |
| **v2** | Agentic Development Environment | Deeper development workflows; Milly may gain optional voice; desktop automation |
| **Future** | Agentic Operating System | Broader system-level agency beyond the development workspace |

Do not pull Future/OS framing into v1 delivery language. Do not pull v2 voice into v1.

---

## 8. v1 Scope

**Product form:** Agentic Intelligent Workspace

In scope for v1 product direction:

- PRISM Desktop as the product shell
- Dashboard, Milly, Memory, Thoughts, Planning, Execution, Workspace
- VS Code / Code-OSS embedded as the **editing engine** (not the outer product)
- Cognitive pipeline, memory, planning, reflection, trust, tool + execution runtimes
- Local-first identity and workspace
- Provider-independent model routing
- Transparent reasoning and execution visualization
- Milly as silent cognitive presence

Out of v1 product form (see Non-goals / later phases):

- Voice for Milly
- Desktop automation as a primary product pillar
- Positioning PRISM as “an AI IDE” or “VS Code fork”
- Chatbot-default primary UI
- Claiming Agentic OS as the current product

Feature-level delivery tracking remains in `V1_SCOPE.md` and must stay consistent with this constitution.

---

## 9. v2 Scope

**Product form:** Agentic Development Environment

- Extends v1 workspace into a fuller agentic development environment
- Optional Milly voice
- Desktop automation capabilities
- Still: PRISM is the product; editing engines remain integrated, not inverted

---

## 10. Future Scope

**Product form:** Agentic Operating System

- System-level agency beyond the development workspace
- Additional shapes (mobile, CLI, other adapters) under One Mind
- Must remain additive to frozen architecture principles

---

## 11. Rules for Introducing New Features

1. **Constitution first** — Features must not violate Sections 2–6.
2. **Architecture freeze** — Prefer implementation inside frozen systems; no redesign for convenience.
3. **Ownership test** — If a feature is editing UX (Monaco, git UI, terminal chrome), it belongs to the editing engine — integrate, don’t rebuild.
4. **Intelligence test** — If a feature reasons, remembers, plans, reflects, or trusts, it belongs to PRISM core — not the editor.
5. **Hierarchy test** — New surfaces attach under PRISM Desktop; never invert to “VS Code + PRISM plugin” as the product model.
6. **Phase test** — Voice, desktop automation, and OS-level claims belong to v2/Future unless explicitly re-locked.
7. **Chat modality test** — Chat may clarify intent; it must not become the primary product architecture.
8. **Local-first / provider-independent** — No mandatory cloud identity or single-vendor hardcoding.
9. **Extend before replace** — Reuse managers, stores, services, and components.
10. **Document public changes** — Update constitution-linked docs when product-facing behavior changes.

---

## 12. Definition of Done for v1

v1 is done when PRISM is credibly an **Agentic Intelligent Workspace** that:

1. Boots as **PRISM Desktop** (not as a VS Code skin with PRISM bolted on).
2. Exposes the locked product surfaces: Dashboard, Milly, Memory, Thoughts, Planning, Execution, Workspace, and VS Code Editor.
3. Owns intelligence end-to-end: memory, planning, reflection, trust, tool runtime, execution runtime.
4. Uses VS Code/Code-OSS strictly as an **editing engine** inside the product.
5. Keeps Milly as cognitive presence **without voice**.
6. Remains local-first and provider-independent.
7. Reasons before executing tools (no tool-first chatbot loop as the architecture).
8. Does not market or structure itself as a ChatGPT clone, VS Code fork, or generic AI IDE.
9. Aligns documentation and UI copy with this constitution.
10. Ships with architecture still frozen — implementation complete, not redesigned.

---

## 13. Non-goals

- Forking or rebranding VS Code as PRISM
- Rebuilding Monaco / explorer / search / git / terminal / debugger as PRISM core
- Chatbot-default primary UX
- Mandatory cloud login for core use
- Single-provider lock-in
- Milly voice in v1
- Desktop automation as a v1 pillar
- Claiming “Agentic OS” as the current shipped product identity
- Endless architecture redesign under the guise of product discovery

---

## 14. Relationship to Other Documents

| Document | Role relative to this constitution |
|----------|--------------------------------------|
| `ARCHITECTURE_FREEZE.md` | Frozen technical/UX architecture governance |
| `ARCHITECTURE_V1.md` / `ARCHITECTURE.md` | System structure — must not contradict product ownership |
| `EXPERIENCE_ARCHITECTURE.md` | UX rules — product shell hierarchy follows this constitution |
| `V1_SCOPE.md` | Feature milestone tracking under v1 product form |
| `01_VISION.md` … `10_ADR.md` | Historical — superseded on product identity conflicts |
| Historical design mockups (removed `Desboard/`) | Aspirational only — not product canon if they inverted hierarchy or implied AI IDE/chatbot-first |

---

## 15. Change Policy

This constitution is **locked**.

Changes require an explicit product decision recorded as an additive amendment (date, reason, what superseded). Do not silently rewrite identity through UI copy, mockups, or README drift.
