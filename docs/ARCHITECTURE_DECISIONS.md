# Architecture Decisions

This document records the key architectural decisions that shaped PRISM v0.9.0 Alpha. It replaces the legacy `10_ADR.md` document, condensing the core philosophies into a single reference.

---

### 1. Local-First Architecture
**Decision**: PRISM must be fully functional offline, prioritizing local models (Ollama, LM Studio) and local storage (PostgreSQL, Qdrant on Docker).
**Rationale**: Users must own their memories, graphs, and code. No vendor lock-in or mandatory cloud subscriptions are permitted. Cloud models (OpenAI, Anthropic) are supported purely as optional capability enhancements.

### 2. Engine before Renderer
**Decision**: The intelligence (Kernel, Memory, Planner, Tools) lives entirely in the Python backend. The UI (React/Tauri) is strictly a renderer of backend state.
**Rationale**: "PRISM owns the intelligence, not the interface." By decoupling the UI, the exact same intelligence can manifest in multiple shapes without duplicating business logic. Additional surfaces must remain under PRISM ownership — not an inverted “IDE + PRISM plugin” product model.

### 3. Identity before Authentication
**Decision**: PRISM Desktop uses an `IdentityManager` to track local user profiles and preferences, rather than requiring an OAuth/Cloud authentication login.
**Rationale**: Aligns with the local-first philosophy. A user's identity is defined by their local configuration and capability tags, not a centralized cloud database.

### 4. Manager vs Service Separation
**Decision**: The Desktop service layer is strictly organized into stateless `Managers` that execute actions and update reactive `Stores`.
**Rationale**: Avoids React component bloat (prop-drilling) and global mutable state singletons. `useSyncExternalStore` provides safe, concurrent React 19 bindings to pure TypeScript data structures.

### 5. Event-Driven Synchronization
**Decision**: The Execution Runtime communicates state changes to the UI via a global `EventBus` broadcast over WebSockets, rather than requiring the UI to poll REST endpoints.
**Rationale**: Execution sessions can last hours (e.g., long-running builds). Streaming events ensures immediate visual feedback (60fps UI targets) without overwhelming the backend with polling requests.

### 6. Provider-Independent Architecture
**Decision**: The `ModelRouter` and `ToolOrchestrator` do not depend on OpenAI's specific tool-calling API or Anthropic's specific message formats. `LiteLLM` acts as the universal abstraction layer.
**Rationale**: AI models evolve rapidly. Hardcoding to a specific provider's API structure introduces massive technical debt. Providers are treated purely as pluggable execution details.

### 7. Plugin-First Extensibility
**Decision**: Capabilities (new tools, panels, commands, providers) must be registered via the `PluginSDK` manifest hooks (`onRegister`, `onStart`, `onStop`), rather than hardcoding them into the core loop.
**Rationale**: Ensures the core architecture remains stable while allowing infinite extensibility by the open-source community.

### 8. Milly as Cognitive Presence
**Decision**: The Milly Engine visually maps the backend's cognitive state (Planning, Executing, Reflecting, Healing) directly to abstract UI animations (waves, radar, glitch) instead of acting as an anthropomorphic chatbot avatar.
**Rationale**: PRISM is an Agentic Intelligent Workspace, not a chatbot. Visualizing actual system states builds user trust and explainability, avoiding the "black box" nature of traditional LLM wrappers. Milly has no voice in v1.

### 9. Architecture v1.0 Freeze
**Decision**: The architectural specifications governing PRISM's boundaries, UX, design language, and components are frozen as of v1.0 design.
**Rationale**: Prevents scope creep, endless refactoring, and AI-agent "hallucinations" of new systems. All development must fit within the predefined frozen boundaries.

### 10. Product Constitution — Agentic Intelligent Workspace
**Decision**: PRISM's locked product identity is an Agentic Intelligent Workspace. PRISM Desktop is the product shell; VS Code/Code-OSS is an embedded editing engine. PRISM is not a VS Code fork, not a ChatGPT clone, and not "another AI IDE."
**Rationale**: Clarifies ownership boundaries (intelligence vs editing UX) and locks roadmap: v1 Workspace → v2 Agentic Development Environment → Future Agentic OS. Canon: `docs/11_PRODUCT_CONSTITUTION.md`.
