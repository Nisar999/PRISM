# PRISM v0.9.0 Alpha Scope

This document tracks feature delivery toward **v1 — Agentic Intelligent Workspace**.

Product identity, ownership boundaries, and phase roadmap are locked in [11_PRODUCT_CONSTITUTION.md](11_PRODUCT_CONSTITUTION.md). This file does not redefine product identity.

## Locked roadmap (reference)

| Phase | Form |
|-------|------|
| **v1** | Agentic Intelligent Workspace (Milly has no voice) |
| **v2** | Agentic Development Environment (optional Milly voice + desktop automation) |
| **Future** | Agentic Operating System |

## Completed (v0.9.0 Alpha)

### Backend Core
- ✅ PRISM Kernel bootstrap and Mind Registry.
- ✅ 20 Capability and Skill registries.
- ✅ Intent, Goal, and Strategy Engines.
- ✅ Knowledge Graph for semantic ontology.
- ✅ Cognitive Planner and Model Router.
- ✅ Tool Orchestrator with 11 tool categories.
- ✅ Execution Runtime with MockExecutor.
- ✅ Memory Engine (Episodic, Semantic, Procedural, Temporal, Failure).
- ✅ Provider Manager (Ollama, LM Studio, OpenRouter, OpenAI, Anthropic, Gemini).
- ✅ FastAPI REST API.
- ✅ Docker Compose orchestration (10 services).

### Desktop Client
- ✅ Tauri v2 native shell with React 19 and Vite.
- ✅ Reactive State Layer (`Store<T>`).
- ✅ Command Registry and Command Palette UI.
- ✅ Layout Engine (docks, splits, panels).
- ✅ Workspace Manager and Workspace Explorer UI.
- ✅ Graph Engine and SVG Execution Graph Canvas.
- ✅ Identity Engine for local user profiles.
- ✅ Provider Manager for client-side tracking.
- ✅ Tool Runtime tracking.
- ✅ Milly Engine and animated Milly Renderer.
- ✅ Settings Manager and Settings Page UI.
- ✅ Plugin SDK with manifest and lifecycle hooks.
- ✅ Complete architecture documentation synchronization.

## Current Active Work

- 🔄 **Kernel WebSocket Bridge**: Integrating the backend EventBus with the desktop API client for live execution streaming.
- 🔄 **Tauri FS Capabilities**: Mapping Tauri v2 filesystem permissions to the backend capability registry for local-first project access.
- 🔄 **Product Constitution alignment**: Locked product identity; documentation updated to match Agentic Intelligent Workspace hierarchy.

## Planned (Towards v1 — Agentic Intelligent Workspace)

- 📅 **PRISM Desktop product surfaces**: Dashboard, Milly, Memory, Thoughts, Planning, Execution, Workspace, with VS Code/Code-OSS as embedded editing engine (not the outer product).
- 📅 **End-to-End Integration Tests**: Validating the full execution pipeline from desktop intent to backend tool execution.
- 📅 **Trust Engine**: Completing the trust evaluation logic during the Reflection phase.
- 📅 **Planning Engine Enhancements**: Dynamic task decomposition and re-routing during live execution sessions.

## v2 (Agentic Development Environment)

- 🔮 **Optional Milly voice**
- 🔮 **Desktop automation**
- 🔮 Deeper agentic development workflows (still PRISM-as-product)

## Future (Agentic Operating System)

- 🔮 System-level agency beyond the development workspace
- 🔮 Plugin Marketplace
- 🔮 Collaboration / shared memories
- 🔮 Deep MCP bridges
- 🔮 Additional interface shapes under One Mind
