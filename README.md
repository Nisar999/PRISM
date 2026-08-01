# 🔺 PRISM

> **Persistent Reasoning with Intelligent Self-healing Memory**

PRISM is an **Agentic Intelligent Workspace** — an open-source, local-first
desktop system that combines persistent memory, self-healing reasoning,
multi-agent workflows, and an embedded VS Code–class editor.

PRISM owns the intelligence. Interfaces own the experience.
VS Code is an editing engine. PRISM is the product.

> **Status:** `v1.0.0-rc.1` (release candidate) — productionization pass complete.
> **License:** GNU GPL v3 — see [LICENSE](LICENSE).
> **Architecture canon:** [docs/11_PRODUCT_CONSTITUTION.md](docs/11_PRODUCT_CONSTITUTION.md)

---

## Architecture

PRISM is a modular monorepo with three primary packages:

| Package | Stack | Purpose |
|---------|-------|---------|
| [`backend/`](backend) | Python · FastAPI · LangGraph · Pydantic · LiteLLM | Cognitive pipeline, memory engine, provider abstraction, REST + SSE API |
| [`desktop/`](desktop) | TypeScript · Tauri v2 · React 19 · Vite · TailwindCSS | Native desktop shell, UI, client-side services, Code-OSS host |
| [`docker/`](docker) | Docker Compose | Postgres · Neo4j · Qdrant · Redis · Ollama orchestration |

> Full reference: [docs/ARCHITECTURE_V1.md](docs/ARCHITECTURE_V1.md) ·
> Navigation hub: [docs/ARCHITECTURE_INDEX.md](docs/ARCHITECTURE_INDEX.md)

### Locked user flow

```
Splash → Authentication → Conversation Hub → Launch PRISM IDE → Code-OSS
```

This flow is frozen and must not change.

---

## Core Systems

### Backend — Cognitive Pipeline

```
Intent Engine → Goal Registry → Strategy Engine → Knowledge Graph
  → Context Engine → Cognitive Planner → Model Router
    → Tool Orchestrator → Execution Runtime
```

- **Memory Engine** — Episodic, Semantic, Procedural, Temporal, and Failure
  memory with adaptive retrieval, MemScore ranking, and self-healing.
- **Provider Manager** — LiteLLM abstraction over Ollama, LM Studio,
  OpenRouter, OpenAI, Anthropic, and Gemini.
- **Agent Graph** — LangGraph pipeline: Planner → Retrieval → Reasoning →
  Reflection → Trust → Curator. Streaming via Server-Sent Events (`/agent/stream`).

### Desktop — Service Layer

- **State** — generic `Store<T>` with `useSyncExternalStore` bindings.
- **Command Registry** — fuzzy search, keybindings, categorized execution.
- **Layout Engine** — dock model, split layouts, panel registry, persistence.
- **Workspace Manager** — Project/Session/Artifact hierarchy, native
  folder dialog (Tauri), recent-workspace persistence and restore.
- **Identity / Authentication** — local-first `IdentityManager` with an
  `AuthenticationService` session layer: encrypted (PBKDF2 + AES-GCM)
  device-bound sessions, automatic restore, no cloud auth in v1.
- **Provider Manager** — auto-detection of Ollama, LM Studio, and
  OpenAI-compatible local endpoints; live model lists.
- **Milly Engine** — cognitive presence state machine synced with runtime.
- **Code-OSS Host** — `vscodeWorkspaceAdapter` postMessage bridge to an
  embedded Code-OSS web workbench.

### Desktop — UI

- **Conversation Hub** — streaming chat with live PRISM responses.
- **Command Palette** — `Ctrl+K` overlay, fuzzy search, keyboard nav.
- **Workspace Explorer** — project tree, session/artifact browsing.
- **Milly Renderer** — animated cognitive presence, state-driven visuals.
- **Settings** — searchable categorized settings with validation.
- **Editor Host** — full-bleed Code-OSS workbench on `/editor`.

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 20 (desktop)
- **Python** ≥ 3.12 (backend)
- **Rust** stable + Tauri v2 prerequisites (desktop native build)
- **Docker** + Docker Compose (infrastructure)

### 1. Infrastructure (Docker)

```bash
cp .env.example .env
docker compose up -d postgres neo4j qdrant redis ollama
```

### 2. Backend API

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Unix: source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn prism.main:create_app --factory --reload --host 127.0.0.1 --port 8000
```

### 3. Desktop Client

```bash
cd desktop
npm install
npm run dev              # Vite UI at http://127.0.0.1:1420
# npm run tauri -- dev   # native shell (requires Rust + staged runtime)
```

### Full stack in Docker

```bash
cp .env.example .env
docker compose up --build
```

| Service | Port | Purpose |
|---------|------|---------|
| Backend | 8000 | FastAPI + OpenAPI |
| PostgreSQL | 5432 | Relational storage |
| Neo4j | 7474 / 7687 | Graph relationships |
| Qdrant | 6333 | Vector search |
| Redis | 6379 | Cache + workers |
| Ollama | **11435** | Local LLM (host → container 11434) |
| Prometheus | 9090 | Metrics |
| Grafana | 3001 | Dashboards |

API docs: http://127.0.0.1:8000/docs

> Full onboarding: [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md)

---

## Build & Release

```bash
# Desktop dev executable (no installer bundling) → build/latest/PRISM Desktop.exe
cd desktop
npm run build:desktop

# Full self-contained installer (stages runtime + NSIS bundle)
npm run release:installer
```

`build:desktop` produces a stable executable at `build/latest/PRISM Desktop.exe`
via `scripts/copy-latest-build.mjs`. See
[docs/RELEASE2_SELF_CONTAINED_INSTALLER.md](docs/RELEASE2_SELF_CONTAINED_INSTALLER.md)
for the installer layout.

---

## Supported Platforms

| Platform | Status |
|----------|--------|
| Windows 10/11 (x64) | Verified — native Tauri build + NSIS installer |
| macOS (Apple Silicon / Intel) | Supported by Tauri; not yet verified in CI |
| Linux (x64) | Supported by Tauri; not yet verified in CI |

PRISM is local-first and runs fully offline with a local model (Ollama / LM Studio).

---

## Documentation

The canonical entry point is
[docs/ARCHITECTURE_INDEX.md](docs/ARCHITECTURE_INDEX.md) (Layer 0 → 3 reading paths).

| Area | Document |
|------|----------|
| Product canon | [11_PRODUCT_CONSTITUTION.md](docs/11_PRODUCT_CONSTITUTION.md) |
| Architecture | [ARCHITECTURE_V1.md](docs/ARCHITECTURE_V1.md) · [ARCHITECTURE_FREEZE.md](docs/ARCHITECTURE_FREEZE.md) |
| API surface | [API_SURFACE.md](docs/API_SURFACE.md) |
| Desktop shell | [DESKTOP_SHELL.md](docs/DESKTOP_SHELL.md) |
| Services | [SERVICE_OVERVIEW.md](docs/SERVICE_OVERVIEW.md) · [COMPONENT_MAP.md](docs/COMPONENT_MAP.md) |
| Decisions | [ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) |
| Development | [DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) · [CONTRIBUTING.md](docs/CONTRIBUTING.md) |
| Implementation audit | [IMPLEMENTATION_AUDIT.md](docs/IMPLEMENTATION_AUDIT.md) |

### Frozen architecture specs

The following are **frozen** and must not be modified except through the
governance process in [ARCHITECTURE_FREEZE.md](docs/ARCHITECTURE_FREEZE.md):

`EXPERIENCE_ARCHITECTURE.md` · `UI_DESIGN_LANGUAGE.md` · `INTERACTION_LANGUAGE.md`
· `COMMAND_SURFACE.md` · `WORKSPACE_SYSTEM.md` · `VISUAL_COGNITION.md`
· `MOTION_LANGUAGE.md` · `MILLY_EXPERIENCE.md` · `BRAND_ASSETS.md`

---

## Repository Layout

```
PRISM/
├─ backend/      Python backend (FastAPI, LangGraph, LiteLLM)
├─ desktop/      Tauri v2 + React desktop shell (includes src-tauri/)
├─ docker/       Service Dockerfiles + docker-compose.yml
├─ docs/         Architecture, frozen specs, audit, guides
├─ scripts/      Runtime staging + Code-OSS operator scripts
├─ assets/       Brand assets (logos, mascots)
├─ .github/      CI, issue/PR templates, dependabot, security policy
├─ .env.example  Docker Compose environment template
└─ README.md
```

Vendored / generated trees (`vscode-main/`, `desktop/src-tauri/resources/runtime/`,
`desktop/src-tauri/target/`, `node_modules/`, `.venv/`) are **not tracked** —
they are fetched or built locally. See [`.gitignore`](.gitignore).

---

## Contributing

PRISM's architecture is **frozen**. Before contributing, read
[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) and
[docs/ARCHITECTURE_FREEZE.md](docs/ARCHITECTURE_FREEZE.md). Changes to frozen
surfaces require a documented deviation against the governing ADR.

Report security issues privately — see [`.github/SECURITY.md`](.github/SECURITY.md).

---

## Philosophy

Experience enters. PRISM refracts it. Memory becomes intelligence.
Intelligence becomes evolution.

---

## License

Copyright (c) PRISM contributors. Licensed under the
**GNU General Public License v3** — see [LICENSE](LICENSE). No warranty is
provided; see sections 15–16 of the License. Third-party components retain
their original licenses (documented per package; see
[docs/BRAND_ASSETS.md](docs/BRAND_ASSETS.md) for asset attribution).
