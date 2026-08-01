# PRISM v1.0.0-rc.1 — Release Candidate Report

**Date:** 2026-07-29  
**Architecture impact:** ZERO (no new managers, stores, or backend APIs)  
**Goal:** Stable enough for daily personal use

---

## Verdict

**PRISM Desktop `1.0.0-rc.1` is release-candidate ready for personal daily use**, with Code-OSS workbench available when `:8080` is served. Core product surfaces (Conversation, Agent panel, Settings, Memory, Providers, Milly, IDE host) build clean and are wired to existing backends/managers.

---

## Production build

| Check | Result |
|-------|--------|
| `desktop` `tsc && vite build` | **PASS** (exit 0) |
| Bundle split | `react` ~49 kB · `icons` ~11 kB · app `index` ~414 kB (gzip ~123 kB) |
| Known Vite note | `tools.ts` static+dynamic import (plugins + store) — non-blocking |
| Backend `create_app()` | **PASS** (`backend_ok PRISM OS`) |
| Docker compose present | **PASS** (`docker/docker-compose.yml`) |
| Code-OSS host + script | **PASS** (`desktop/public/code-oss-host/`, `scripts/code-oss-web.ps1`) |

Version: `desktop/package.json` + `PRODUCT.version` → **`1.0.0-rc.1`**.

---

## Verification matrix

| Area | Status | Notes |
|------|--------|-------|
| Frontend | **PASS** | Routes + AppShell; production build green |
| Backend | **PASS** | health / provider / memory / agent / events routers |
| Docker | **PASS** | Core infra compose; Code-OSS optional compose |
| VS Code / IDE | **PARTIAL→OK for RC** | `/editor` → EditorHost → code-oss-host; needs `code-oss-web.ps1` for full workbench |
| Providers | **PASS** | `providerManager.bootstrap()` on boot |
| Memory | **PASS** | `memoryManager` + backend Memory; Agent Memory tab |
| Milly | **PASS** | Engine sync + **MillyRenderer remounted** in TitleBar; Prism/Globe views |
| Agent | **PASS** | `agentManager` + Agent panel Thoughts |
| Terminal | **PASS** | Code-OSS owns IDE terminal; ExecutionDock = graph/output/review |
| Settings | **PASS** | Cursor-style General · Appearance · Models · Providers · Mirror |
| Conversation | **PASS** | `/conversation` ChatHub + Agent Chat tab (same artifact) |
| IDE | **PASS** | Full-bleed `/editor`; chrome collapses |

---

## RC hygiene completed

| Item | Action |
|------|--------|
| `console.log` / `console.info` in `desktop/src` | **Removed** |
| Debug noise | Gated via `lib/debug.ts` + Settings → Debug logging |
| Unused npm deps | Removed `class-variance-authority`, `@tauri-apps/plugin-opener` (JS); Tauri Rust opener plugin retained |
| Bundle | manualChunks for react/icons; no sourcemaps in prod |
| Backend example | `PRISM_DEBUG=false` in `backend/.env.example` |
| MillyRenderer | Remounted (was orphaned) |

---

## Operator bring-up (daily use)

```powershell
# Infra + API
docker compose -f docker/docker-compose.yml up -d postgres neo4j qdrant redis ollama
cd backend; .\.venv\Scripts\Activate.ps1
uvicorn prism.main:create_app --factory --host 127.0.0.1 --port 8000

# Optional editing engine
pwsh scripts/code-oss-web.ps1

# Desktop
cd desktop; npm run dev
# or production preview: npm run build && npm run preview
```

---

## Known RC limitations (honest)

1. **Code-OSS** must be running on `:8080` for Explorer/Tabs/Terminal/Problems/Search inside `/editor`.
2. **Deep IWorkbench sync** (live active-editor events) still future — adapter navigates folder/file.
3. **npm audit** reports 3 high severity issues in the desktop tree (transitive); not blocking RC smoke — revisit before GA.
4. **No ESLint package** in desktop — TypeScript (`tsc`) is the gate; formatting is project-conventional.
5. Product still personal-RC: not multi-user SaaS hardened.

---

## Architecture freeze

No new managers, stores, workflows, or backend surfaces were introduced for this RC. Changes were presentation, hygiene, versioning, and build config only.

---

## Related docs

- [V1_RELEASE_AUDIT.md](V1_RELEASE_AUDIT.md)  
- [DESKTOP_SHELL.md](DESKTOP_SHELL.md)  
- [VSCODE_INTEGRATION_STATUS.md](VSCODE_INTEGRATION_STATUS.md)  
- [V1_SCOPE.md](V1_SCOPE.md)  
