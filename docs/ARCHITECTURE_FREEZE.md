# PRISM Architecture Freeze

## Overview
This governance document formally declares the completion of PRISM's foundational Phase II architecture. The underlying structural, cognitive, and experience specifications are now considered **architectural canon**.

---

## 1. Purpose

The architecture of PRISM is officially frozen to shift focus from conceptual design to rigorous implementation. 

Endless architectural redesign leads to implementation drift and scope creep. By freezing the architecture, we guarantee that all future engineering efforts, plugin development, and UI construction follow a stable, unified vision. Future work must strictly prioritize implementation over structural redesign.

---

## 2. Canonical Documents

The following documents constitute the official PRISM Architecture v1.0. They are the single source of truth for the system's behavior and design.

### Kernel & Backend
- **Core Architecture** (`docs/ARCHITECTURE.md`)
- **Memory Engine**
- **Reflection Engine**
- **Trust Engine**
- **Router**
- **Tool Orchestrator**

### Runtime
- **Execution Runtime**

### Experience & Interaction
- **Experience Architecture** (`docs/EXPERIENCE_ARCHITECTURE.md`)
- **Interaction Language** (`docs/INTERACTION_LANGUAGE.md`)
- **Command Surface** (`docs/COMMAND_SURFACE.md`)
- **Workspace System** (`docs/WORKSPACE_SYSTEM.md`)

### Interface & Visualization
- **Desktop Shell**
- **UI Design Language** (`docs/UI_DESIGN_LANGUAGE.md`)
- **Visual Cognition** (`docs/VISUAL_COGNITION.md`)
- **Motion Language** (`docs/MOTION_LANGUAGE.md`)
- **Milly Experience** (`docs/MILLY_EXPERIENCE.md`)

### Assets
- **Brand Assets** (`docs/BRAND_ASSETS.md`)

### Product Identity
- **Product Constitution** (`docs/11_PRODUCT_CONSTITUTION.md`) — permanent product canon; supersedes older identity assumptions

---

## 3. Change Policy

The architecture is frozen, but not dead. Modifications must follow strict governance boundaries.

### Permitted Changes (No Architectural Review Required)
- **Additive Specifications**: Adding a new, non-conflicting tool schema or memory index type.
- **Implementation Details**: Optimizing a specific database query or rewriting a React component to match the `UI_DESIGN_LANGUAGE.md` more accurately.
- **Bug Fixes**: Patching crashes, fixing performance bottlenecks, or correcting typographical errors in the documentation.
- **Platform Adaptations**: Porting the Desktop UI shell to a Web UI shell, provided it obeys the established Experience Architecture.

### Restricted Changes (Requires Formal Architectural Review)
- **Changing the Memory Model**: Altering how context is injected, retrieved, or trusted.
- **Changing the Workspace Model**: Deviating from the strict Project/Session/Artifact hierarchy.
- **Changing the Interaction Philosophy**: Modifying the progressive disclosure layers or adding conversational chatbot behaviors.
- **Changing Core Principles**: Any deviation from local-first, modular, or provider-independent behaviors.

---

## 4. Architectural Principles

These principles are permanent and non-negotiable. They must govern every current and future codebase contribution:

1. **One Mind. Infinite Shapes.**
2. **PRISM owns the intelligence.**
3. **Interfaces own the experience.**
4. **Provider independent.**
5. **Editing-engine independent (not an IDE product).** PRISM is not a VS Code fork and does not rebuild editor UX. VS Code/Code-OSS may be embedded as the editing engine inside PRISM Desktop; intelligence never lives in the editor.
6. **Local-first.**
7. **Modular.**
8. **Long-lived architecture.**

Product identity and roadmap are governed by `docs/11_PRODUCT_CONSTITUTION.md` (Agentic Intelligent Workspace → ADE → Agentic OS).

---

## 5. Future Work

With the architecture frozen, the following milestones are strictly implementation phases, not redesigns:

- **Desktop UI**: Building the Tauri/React components governed by the Visual Cognition and UI Design Language docs.
- **Backend Completion**: Finalizing the FastAPI endpoints, Celery workers, and Qdrant memory layer.
- **Plugin SDK**: Providing the standard library for third-party extensions to hook into the Tool Orchestrator.
- **MCP Integrations**: Building the bridges for the Model Context Protocol.
- **Local Model Integrations**: Finalizing Llama.cpp and Ollama local routing support.
- **Testing**: Reaching target code coverage across the execution pipeline.
- **Packaging**: CI/CD pipelines, Docker containerization, and cross-platform binary builds.

---

## 6. Versioning

This specification is formally declared as **PRISM Architecture v1.0**.

Future evolution of the architecture must happen through additive RFC-style proposals (Request for Comments). Canonical documents should not be rewritten or heavily refactored to support new paradigms; instead, new versions of the architecture must explicitly document breaking changes and transition paths.

---

## 7. Governance

Evaluation of architectural changes follows a philosophy of minimal disruption:

- **Encourage Minimal Change**: If a problem can be solved via implementation optimization rather than architectural restructuring, implementation wins.
- **Prefer Extension Over Replacement**: If a new interaction paradigm is required, build it as an additive layer rather than replacing the foundational core.
- **Immutable Canon**: Do not rewrite history. If an architectural decision was flawed, document the flaw and propose an additive fix, rather than pretending the original decision never happened.

---

## 8. Anti-Patterns

To preserve stability, developers and contributing agents must explicitly avoid these anti-patterns:

- **Endless Redesign**: The constant refactoring of system abstractions instead of shipping features.
- **Duplicated Architecture Documents**: Creating new markdown files that overlap or redefine existing rules.
- **Conflicting Specifications**: Writing UI code that violates the Interaction Language.
- **Undocumented Architectural Decisions**: Sneaking architectural changes into code commits without updating the canonical documentation.
- **Implementation-Driven Architecture Drift**: Allowing quick-and-dirty code hacks to become the de-facto architecture simply because they were merged.
