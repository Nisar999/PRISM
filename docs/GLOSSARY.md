# PRISM Glossary

This document defines the core terminology used throughout the PRISM codebase and architecture.

Product identity canon: [11_PRODUCT_CONSTITUTION.md](11_PRODUCT_CONSTITUTION.md).

### Product
- **Agentic Intelligent Workspace**: Locked v1 product form of PRISM — not a VS Code fork, ChatGPT clone, or generic AI IDE.
- **Editing Engine**: The embedded code-editing stack (VS Code / Code-OSS: Monaco, explorer, search, git, terminal, debugger, extensions). Owned by the editor; not PRISM intelligence.
- **PRISM Desktop**: The product application shell. Contains Dashboard, Milly, Memory, Thoughts, Planning, Execution, Workspace, and the VS Code Editor surface.

### Core Systems
- **Kernel**: The central runtime and bootstrapping entry point of the Python backend. Coordinates initialization of all subsystems.
- **Planner**: (Cognitive Planner) The engine that breaks down high-level user intents into structured, actionable execution plans.
- **Router**: (Model Router) The engine responsible for evaluating tasks and assigning them to the most optimal LLM provider based on complexity, context window, and cost.
- **Reflection**: The post-execution analysis phase where the system checks its own outputs for hallucinations, contradictions, or unsupported claims before finalizing an answer.
- **Trust**: (Trust Engine) The subsystem that audits the reflection process and evaluates the reliability of retrieved memories to prevent false positives.

### Workspace & Data
- **Workspace**: The persistent, local-first data hierarchy containing all user data, organized into Projects, Sessions, and Artifacts.
- **Artifact**: A versioned, discrete output generated during a session (e.g., a written file, a code snippet, a diagram).
- **Session**: A continuous context window tracking the execution pipeline for a specific user request or task thread.
- **Execution Graph**: A Directed Acyclic Graph (DAG) visualizing the flow of tasks, tool calls, and logic during a Session.

### Execution & Extensibility
- **Provider**: An external AI model integration (e.g., Ollama, OpenAI, Anthropic). Treated purely as a pluggable execution detail via LiteLLM.
- **Tool Runtime**: The engine responsible for orchestrating, tracking, and logging the execution of specific capabilities/tools.
- **Plugin**: A modular extension that registers new capabilities, panels, or tools with the Desktop client using manifest lifecycle hooks.

### Interface
- **Milly**: The cognitive presence of PRISM. A visual, animated representation of the backend's current processing state (e.g., thinking, executing, reflecting) rather than a conversational avatar. No voice in v1.

### Memory Types
- **Episodic Memory**: Records of time-bound experiences and exact historical interactions.
- **Semantic Memory**: Factual, generalized knowledge and concepts extracted from interactions.
- **Procedural Memory**: Acquired skills, tool usage patterns, and "how-to" logic.
- **Temporal Memory**: Transient state information that naturally decays or expires over time.
- **Failure Memory**: Records of errors, hallucinations, or failed tool calls. Critical for self-healing; never decays or is deleted.
