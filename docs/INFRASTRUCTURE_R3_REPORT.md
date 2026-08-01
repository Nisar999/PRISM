# PRISM Desktop — Sprint R3 Infrastructure Report

Last updated: 2026-07-27

**Architecture impact:** ZERO (presentation wording, startup scripts, health probes, and Rust FS unit test only; no new managers, stores, or workflows).

---

## Executive summary

| Area | Status | Notes |
| --- | --- | --- |
| Code-OSS embed | **Blocked until :8080 serves** | Script/probe fixes landed; Docker build started for workbench |
| Ollama / providers | **Partial** | Direct Ollama probe OK on host; backend optional for local AI |
| Tauri filesystem | **Pass (automated)** | Rust command round-trip test green; UI path uses same commands |
| Notifications | **Done** | Product-facing copy; dedup architecture unchanged |
| Release readiness | **Dev-ready** | Native shell + FS + Ollama; full editor needs Code-OSS service |

---

## Part 1 — Code-OSS integration

### How it works

1. **PRISM Desktop** (`npm run tauri dev`) → Vite `http://127.0.0.1:1420`
2. **Editor** → iframe `/code-oss-host/index.html?workbench=http://127.0.0.1:8080/`
3. **Host page** probes workbench, then embeds unmodified Code-OSS web in a second iframe
4. **No Vite proxy** to 8080 — workbench is a separate process

### Changes (R3)

| File | Change |
| --- | --- |
| `scripts/code-oss-web.ps1` | `auto` mode **falls back to native** serve when Docker is unavailable (no longer `exit 2`) |
| `desktop/public/code-oss-host/index.html` | Longer probe (8s × 4 retries); removed bridge fallback link; clearer operator message |

### Operator sequence

```powershell
# Terminal 1 — from repo root (Docker preferred if Desktop is running)
pwsh d:\Code_yees\PRISM\scripts\code-oss-web.ps1

# Terminal 2 — native PRISM
cd d:\Code_yees\PRISM\desktop
npm run tauri dev
```

Then: **Sidebar → Editor** (with a workspace open). Expect host lifecycle `ready` and workbench UI inside the editor region.

### Verification at audit time

| Check | Result |
| --- | --- |
| `http://127.0.0.1:8080/` | **Not responding** before `docker compose` bring-up |
| `scripts/code-oss-web.ps1` | Docker path valid; native uses `compile-web` + `code-web.js` |
| Webpack/Rspack | Upstream in `vscode-main`; PRISM uses `npm run compile-web` + `@vscode/test-web` via `code-web.js` |

### Remaining Code-OSS blockers

- **Docker Desktop must be running** before `docker compose -f docker/code-oss-web.compose.yml up --build`. If you see `dockerDesktopLinuxEngine` / pipe not found, start Docker Desktop and retry.
- First **Docker image build** for `prism-code-oss-web:1.131` can take 30–60+ minutes (full `npm ci` + `compile-web`).
- **Native** path needs Node **24** (`.tools/node24` or system), VS C++ toolchain, and successful `compile-web`.
- Editor will show “not reachable” until **8080** answers — this is expected, not a mock fallback.

---

## Part 2 — LLM provider (Ollama)

### Root cause of “Provider Activation Failed”

Desktop `ProviderManager` previously relied only on **FastAPI** `GET /api/v1/provider/health`. When the backend was down, bootstrap called `selectProvider('ollama')` and surfaced a **hard error** toast even if Ollama was running locally.

### Changes (R3)

| File | Change |
| --- | --- |
| `desktop/src/lib/providers.ts` | Direct **Ollama** probe: `GET {base}/api/tags` with 8s timeout; tries `VITE_OLLAMA_BASE_URL`, `127.0.0.1:11434`, `127.0.0.1:11435` |
| | Success toast: **Local AI Connected**; offline: **Local AI offline** (info/warning, not error) |
| | `bootstrap()` uses `softFail: true` — no error spam on startup |
| `desktop/src/lib/api.ts` | Optional `VITE_API_BASE_URL` override |
| `desktop/src/vite-env.d.ts` | `VITE_OLLAMA_BASE_URL`, `VITE_API_BASE_URL` |

### Verification at audit time

| Endpoint | Result |
| --- | --- |
| `http://127.0.0.1:11434/api/tags` | **200** (Ollama reachable) |
| `http://127.0.0.1:8000/api/v1/health` | **Unreachable** (backend not running) |

With R3 logic, **Ollama-only dev** works without backend. Cloud providers still need backend + API keys.

### Operator steps (full stack)

```powershell
# Optional: infra + Ollama via compose (see backend/.env.example — host port 11435)
cd d:\Code_yees\PRISM
docker compose up -d ollama redis postgres   # as needed

# Backend
cd backend
# cp .env.example .env  → OLLAMA_BASE_URL=http://localhost:11435 or 11434
uvicorn prism.main:app --reload --port 8000
```

---

## Part 3 — Filesystem (Tauri + WorkspaceManager)

### Automated validation

Rust unit test exercises the **same commands** `WorkspaceManager` invokes via `tauriInvoke`:

```text
cargo test -p desktop fs_command_tests::create_read_write_delete_roundtrip
→ ok
```

Commands: `create_dir_all`, `write_file_string`, `read_file_string`; delete verified with `std::fs::remove_file` on disk (WorkspaceManager has no dedicated delete API yet).

### Manual validation (Tauri only)

1. `npm run tauri dev` (not `npm run dev` alone — browser uses mock FS).
2. Open **Workspace** → create or open a project folder.
3. Confirm on disk: `project.json`, `sessions/`, `artifacts/`.
4. Restart app → reopen same folder → **Workspace Ready** toast, data persists.

### Status

| Operation | WorkspaceManager + Tauri |
| --- | --- |
| Create | Yes (`createProject`) |
| Read | Yes (`loadProject`, `readProjectFile`) |
| Write | Yes (`writeProjectFile`, sessions/artifacts) |
| Delete | Disk delete not exposed in WM; artifact “Unregister” in UI is store-only |
| Persist | Yes (real paths under user-chosen folder) |

---

## Part 4 — Notifications

Copy updates only (`notificationStore` API unchanged):

| Before | After |
| --- | --- |
| Provider Activated | **Local AI Connected** (Ollama) / `{name} ready` (cloud) |
| Provider Activation Failed | **Local AI offline** / `{name} unavailable` (warning/info) |
| Identity Activated | **Signed in successfully** |
| Plugin Loaded | **Git Assistant Ready** (git plugin) / `{name} ready` |
| Project Created / Loaded / Open Workspace Complete | **Workspace Ready** |
| Profile Updated | **Profile saved** (silent when saving provider preference during activation) |

---

## Remaining blockers

1. **Code-OSS web server** must be running on **8080** for embedded editor (largest gap for “fully operational” IDE).
2. **PRISM backend** optional for local Ollama chat; required for memory/agent WS and cloud providers.
3. **PATH**: `%USERPROFILE%\.cargo\bin` for `rustc` in new terminals (see `docs/NATIVE_DESKTOP_REPORT.md`).
4. **Workspace delete** on disk not wired through WorkspaceManager (product gap, not R3 regression).

---

## Release readiness

| Criterion | Ready? |
| --- | --- |
| Tauri desktop launches | Yes |
| Home / shell / routing | Yes |
| Native filesystem for workspaces | Yes |
| Local Ollama without backend error spam | Yes |
| Embedded Code-OSS editor | **After** `code-oss-web.ps1` succeeds |
| Production bundle `tauri build` | Not re-validated in R3 (dev path green) |

**Recommendation:** Treat R3 as **infrastructure-complete for daily native dev** once Code-OSS compose finishes; ship editor QA as a gated checklist item before release tagging.

---

## Files touched (R3)

- `scripts/code-oss-web.ps1`
- `desktop/public/code-oss-host/index.html`
- `desktop/src/lib/providers.ts`
- `desktop/src/lib/identity.ts`
- `desktop/src/lib/plugins.ts`
- `desktop/src/lib/workspace.ts`
- `desktop/src/lib/workflows/openWorkspace.ts`
- `desktop/src/lib/api.ts`
- `desktop/src/vite-env.d.ts`
- `desktop/src-tauri/src/lib.rs` (FS unit test)
- `docs/INFRASTRUCTURE_R3_REPORT.md` (this file)
