# PRISM Launch Report — Sprint 6

**Date:** 2026-07-27  
**Scope:** First end-to-end launch validation. No new features. Architecture frozen.

---

## Canonical startup (order)

| Step | Command | Working directory |
|------|---------|-------------------|
| 1. Env | `cp .env.example .env` (once) · `cp backend/.env.example backend/.env` (once) | repo root / `backend/` |
| 2. Infra | `docker compose up -d postgres neo4j qdrant redis ollama` | repo root |
| 3. Backend | `uvicorn prism.main:create_app --factory --reload --host 127.0.0.1 --port 8000` | `backend/` (venv active) |
| 4. Desktop | `npm run dev` | `desktop/` |
| 5. Optional native | `npm run tauri -- dev` | `desktop/` (requires Rust) |
| 6. Optional editor | `pwsh scripts/code-oss-web.ps1` or Code-OSS compose on `:8080` | repo root |

**Full Docker stack (alternative):** `docker compose up --build` from repo root.

---

## Commands verified this session

### Desktop
```bash
cd desktop
npm run dev
```
→ **http://127.0.0.1:1420/**

### Backend
```bash
cd backend
.\.venv\Scripts\activate   # Windows
uvicorn prism.main:create_app --factory --reload --host 127.0.0.1 --port 8000
```
→ **http://127.0.0.1:8000/docs** · health **http://127.0.0.1:8000/api/v1/health**

### Docker (infra)
```bash
docker compose up -d postgres neo4j qdrant redis ollama
```

---

## Expected URLs & ports

| Surface | URL / Port |
|---------|------------|
| Desktop Vite | http://127.0.0.1:1420/ |
| Backend API | http://127.0.0.1:8000/api/v1 |
| OpenAPI docs | http://127.0.0.1:8000/docs |
| WebSocket events | ws://127.0.0.1:8000/api/v1/events/ws |
| PostgreSQL | 5432 |
| Neo4j | 7474 / 7687 |
| Qdrant | 6333 |
| Redis | 6379 |
| Ollama | **11435** → 11434 |
| Code-OSS web (optional) | http://127.0.0.1:8080/ |

---

## Environment variables

| File | Role |
|------|------|
| `.env` (root) | Docker Compose service hostnames |
| `backend/.env` | Host uvicorn → localhost infra (`POSTGRES_HOST=localhost`, `OLLAMA_BASE_URL=http://localhost:11435`, …) |
| `desktop/.env` (optional) | `VITE_CODE_OSS_WORKBENCH_URL`, `VITE_CODE_OSS_URL`, `VITE_EDITOR_HOST=bridge`, `VITE_GIT_COMMIT` |

Desktop API base is hard-coded: `http://127.0.0.1:8000/api/v1` (`desktop/src/lib/api.ts`).

---

## Required services

| Service | Required for |
|---------|----------------|
| Desktop Vite | UI (minimum launch) |
| Backend uvicorn | Agent, memory, health, WS |
| Postgres + Qdrant (+ Neo4j/Redis) | Durable memory / full intelligence |
| Ollama (or other provider keys) | Real LLM responses |
| Rust toolchain | Tauri native shell only |
| Code-OSS on :8080 | Full editor workbench embed |

**Minimum runnable:** steps 3–4 (backend may soft-degrade without Docker).  
**Recommended first launch:** steps 1–4.

---

## Launch blocker fixed this sprint

| Issue | Fix |
|-------|-----|
| Vite bound IPv6-only (`[::1]:1420`) so `127.0.0.1:1420` refused | `desktop/vite.config.ts` → `host: "127.0.0.1"`; Tauri `devUrl` aligned |

No other code changes for launch.

---

## Surface validation (automated HTTP)

All SPA routes returned **200** with Vite serving `main` entry:

| Surface | Route | Result |
|---------|-------|--------|
| Splash | overlay on `/` | Route OK — capture manually |
| Dashboard | `/` | PASS (200) |
| Memory | `/memory` | PASS (200) · API search PASS |
| Thoughts | `/thoughts` | PASS (200) |
| Conversation | `/conversation` | PASS (200) |
| Review | `/review` | PASS (200) |
| Planning | `/planning` | PASS (200) |
| Execution | `/execution` | PASS (200) |
| Workspace | `/workspace` | PASS (200) |
| Editor | `/editor` | PASS (200) · host pages 200; workbench **:8080 DOWN** |
| Settings | `/settings` | PASS (200) |
| About | `/about` | PASS (200) |
| Command Palette | in AppShell | Present in code — capture manually (⌘/Ctrl+K) |
| StatusBar | AppShell footer | Present in code — capture manually |
| Milly | AppShell / renderer | Present in code — capture manually |
| Notifications | toasts + dashboard | Present in code — capture manually |

Backend: health **PASS** · memory search **PASS** · DB init **PASS** (after Docker infra).

---

## Screenshots checklist (manual — do not fake)

Capture these in the running app at http://127.0.0.1:1420/:

1. **Splash** — cold load (clear splash session flag if needed)
2. **Dashboard** — home with StatusBar + Milly visible
3. **Command Palette** — open with Ctrl+K / Cmd+K
4. **Workspace** — after **Open Demo Workspace**
5. **Conversation** — empty + one completed ask turn
6. **Code Review** — after a modify request (diff pending)
7. **Memory** — rail or `/memory` with hits
8. **Thoughts** — after agent invoke
9. **Planning** — plan surface
10. **Execution** — graph / `mod.*` or `conv.*` steps
11. **Editor** — `/editor` (note Code-OSS unreachable if :8080 down; bridge optional)
12. **Settings**
13. **About**
14. **Notification toast** — trigger Open Demo or a turn complete
15. **StatusBar** — Connected / Project / Review pending if any

---

## Results summary

| Category | Status |
|----------|--------|
| Desktop Vite launch | **PASS** |
| Backend launch | **PASS** |
| Docker infra | **PASS** (started this session) |
| Memory API | **PASS** |
| All shell routes HTTP | **PASS** |
| Tauri native | **FAIL** — Rust/`cargo` not on PATH |
| Code-OSS :8080 | **FAIL** / optional — not started |
| IPv4 Vite bind | **PASS** (fixed) |

### Warnings
- Without Ollama model pull / provider keys, agent answers may be empty or soft-fail (demo code-mod fallback still works).
- Browser mode uses mock FS; real project writes need Tauri **or** accept mock localStorage paths.
- Editor full workbench needs Code-OSS on :8080.

### Remaining blockers
1. Install **Rust** to run `npm run tauri -- dev` (native FS).
2. Start **Code-OSS web** for full Editor experience.
3. Ensure an LLM (Ollama model or API key) for non-fallback intelligence.

### Release estimate
**~80%** — stack is runnable end-to-end in browser + backend + Docker infra; native shell and full Code-OSS remain environment gaps, not architecture gaps.
