# PRISM Architecture (v0.9.0 Alpha)

PRISM is an **Agentic Intelligent Workspace** (see [11_PRODUCT_CONSTITUTION.md](11_PRODUCT_CONSTITUTION.md)): an open-source system that combines persistent memory, self-healing reasoning, multi-agent workflows, and visual cognition. PRISM owns intelligence; VS Code/Code-OSS may be embedded as an editing engine inside PRISM Desktop.

## High-Level Architecture

PRISM is divided into a backend cognitive pipeline and a frontend desktop client.

```mermaid
flowchart TD
    subgraph Client["PRISM Desktop (Tauri + React)"]
        UI["React Interface"]
        Services["TypeScript Service Layer"]
        SDK["Plugin SDK"]
    end

    subgraph Backend["PRISM Backend (FastAPI + Python)"]
        API["REST & WebSocket API"]
        Pipeline["Cognitive Pipeline"]
        Agents["Agent Graph"]
        Providers["Provider Integration"]
    end

    subgraph Infrastructure["Docker Compose"]
        PG[(PostgreSQL)]
        N4J[(Neo4j)]
        Qdr[(Qdrant)]
        Redis[(Redis)]
        Ollama[Ollama]
    end

    UI --> Services
    Services --> API
    SDK --> Services
    API --> Pipeline
    Pipeline --> Agents
    Pipeline --> Providers
    Agents --> Infrastructure
```

## Backend Cognitive Pipeline

The backend drives the intelligence of PRISM, orchestrating tasks through a series of specialized engines.

```mermaid
flowchart LR
    Intent[Intent Engine] --> Goals[Goal Registry]
    Goals --> Strategy[Strategy Engine]
    Strategy --> Knowledge[Knowledge Graph]
    Knowledge --> Context[Context Engine]
    Context --> Planner[Cognitive Planner]
    Planner --> Router[Model Router]
    Router --> Tools[Tool Orchestrator]
    Tools --> Runtime[Execution Runtime]
```

1. **Intent Engine**: Classifies raw requests and extracts capabilities.
2. **Goal Registry**: Maps intents to execution blueprints.
3. **Strategy Engine**: Determines execution policy (e.g., parallelization).
4. **Knowledge Graph**: Traverses semantic ontology for context.
5. **Context Engine**: Aggregates live runtime state.
6. **Cognitive Planner**: Generates structured `ExecutionPlan`.
7. **Model Router**: Evaluates tasks against provider profiles.
8. **Tool Orchestrator**: Produces `ToolExecutionPlan` per task.
9. **Execution Runtime**: Manages session lifecycle and state.

## Memory Engine

Memory is a core subsystem that operates alongside the cognitive pipeline.

- **Episodic**: Time-bound experiences.
- **Semantic**: Factual knowledge.
- **Procedural**: Acquired skills and tool usage.
- **Temporal**: State that expires over time.
- **Failure**: Records of what did not work (never decays).

## Desktop Service Layer

The desktop client uses a consistent `Manager` → `Store` → `Hook` pattern.

```mermaid
classDiagram
    class Manager {
        +bootstrap()
        +executeAction()
    }
    class Store {
        -state: T
        +subscribe()
        +getSnapshot()
    }
    class ReactComponent {
        +useSyncExternalStore()
    }
    
    Manager --> Store : Updates state
    ReactComponent --> Store : Subscribes to changes
```

### Core Managers
- **WorkspaceManager**: Handles Projects, Sessions, and Artifacts.
- **LayoutManager**: Manages panels, docks, and UI state.
- **ToolManager**: Tracks tool lifecycles and logging.
- **ProviderManager**: Manages client-side provider connections.
- **MillyEngine**: Controls the cognitive presence state machine.

## Application Startup Sequence

```mermaid
sequenceDiagram
    participant OS as Operating System
    participant Main as main.tsx
    participant Stores as State Layer
    participant Managers as Managers
    participant API as Backend API

    OS->>Main: Launch Tauri App
    Main->>Stores: initializeStateLayer()
    Stores->>API: Connect WebSocket
    Main->>Managers: bootstrap() (Identity, Settings, Providers)
    Main->>Managers: pluginManager.bootstrap()
    Main->>Managers: millyEngine.startSync()
    Main->>UI: Render AppShell
```

## Plugin SDK

Plugins can extend the capabilities of the Desktop client. They interact with the system via lifecycle hooks.

1. `onRegister`: Register panels, commands, and providers.
2. `onStart`: Initialize background tasks.
3. `onStop`: Cleanup and unregister.
