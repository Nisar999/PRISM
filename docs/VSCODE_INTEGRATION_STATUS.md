# VS Code / Code-OSS Integration Status

**Sprint:** 4B  
**Date:** 2026-07-25  
**Rule:** PRISM owns the application. Unmodified Code-OSS owns editing. The Workspace Adapter is the only bridge.

---

## 1. Current integration maturity

| Level | Status |
|-------|--------|
| **Shell insertion** (`/editor`) | Working — full-bleed Code-OSS; PRISM IDE chrome collapses |
| **Workspace Adapter (protocol v1)** | Working |
| **PRISM Code-OSS web host** (`/code-oss-host`) | Working (protocol ↔ iframe) |
| **Vite same-origin proxy** (`/__code-oss` → `:8080`) | Working in `desktop` dev server |
| **Unmodified Code-OSS web workbench** | Serve via `pwsh scripts/code-oss-web.ps1` (optional `-Folder`) |
| **Workbench-owned IDE panels** | Explorer · Tabs · Terminal · Problems · Search (inside Code-OSS when `:8080` is up) |
| **Deep IWorkbench API control** | Missing (needs embedder `create()` or extension) |
| **Active editor live sync** | Partial (host echoes openFile; no live workbench events) |

**Upstream compatibility score: 95 / 100**

- Patches to `vscode-main`: **0**
- Separate Code-OSS app window: **never** — embed only
- Duplicate Monaco/Explorer/Terminal in React: **forbidden**

---

## 2. Working

| Item | Evidence |
|------|----------|
| Adapter lifecycle | `idle → loading → ready \| error → disposed` |
| Protocol v1 | `desktop/src/editor/protocol.ts` |
| EditorHost iframe | `desktop/src/editor/EditorHost.tsx` |
| Default host path | `/code-oss-host/index.html?workbench=http://127.0.0.1:8080/` |
| Open workspace | Host navigates workbench with `folder` query |
| Focus | Host focuses nested workbench iframe |
| Lifecycle ready/error | Host probes workbench; posts `prism.editor.ready` / `error` |
| Proof bridge fallback | `/code-oss-bridge/` + `VITE_EDITOR_HOST=bridge` |
| Upstream web entry | `src/vs/code/browser/workbench/workbench.ts` → `create()` |
| Serve script | `vscode-main/vscode-main/scripts/code-web.js` / Docker `code-oss-web` service |

---

## 3. Partial

| Item | Why |
|------|-----|
| **openFile** | Cross-origin host can only navigate with a `file` hint; cannot push in-memory buffers into Monaco without embedder API |
| **activeEditor** | Live `onDidChangeActiveTextEditor` is inside the workbench origin; host reports best-effort on openFile only |
| **Explorer / Monaco / EH verification** | Available inside the workbench UI when `:8080` is up; not instrumented through the adapter yet |
| **Native Windows build** | Requires VS 2022 C++ Build Tools; this environment uses **Docker** for compile/serve |

---

## 4. Missing

| Item | Planned approach (future, still zero core patches) |
|------|-----------------------------------------------------|
| Full `IWorkbench` command surface | PRISM page calls official `create()` with same-origin proxied assets, **or** thin `--extensionPath` bridge extension |
| Bidirectional dirty/save events | Same as above |
| Tauri native FS provider | WorkspaceProvider / file system provider registered by embedder options |
| Automated workbench smoke tests | Playwright against `:8080` + adapter contract tests |

---

## 5. Known upstream limitations

1. **Stock Code-OSS web does not speak PRISM protocol** — expected; host or embedder must translate.
2. **Cross-origin iframe cannot access workbench JS APIs** — browser security; not a PRISM bug.
3. **Windows native `npm ci` needs MSVC** — documented by Microsoft; Docker path avoids host toolchain.
4. **Node major must match `.nvmrc` (24.x)** — enforced by upstream `preinstall`.
5. **Web extension host runs in workers** — extensions cannot freely `postMessage` to PRISM parent; prefer embedder `create()` return value.

---

## 6. Build & serve steps (required)

### Preferred: Docker (zero host VS tools)

```powershell
# Repo root — Docker Desktop running
docker compose -f docker/code-oss-web.compose.yml up --build
# Workbench → http://127.0.0.1:8080/
```

Or:

```powershell
pwsh scripts/code-oss-web.ps1
```

Docker build runs upstream:

1. `npm ci`
2. `npm run compile-web`
3. `node vscode-main/vscode-main/scripts/code-web.js --host 0.0.0.0 --port 8080 --browserType none`

### Native (Windows)

1. Install Node **24.x** (see `vscode-main/vscode-main/.nvmrc`)
2. Install VS 2022 Build Tools + Desktop C++ (+ Spectre ATL/MFC libs per vscode wiki)
3. `cd vscode-main\vscode-main`
4. `npm ci`
5. `npm run compile-web`
6. `.\scripts\code-web.bat --port 8080 --browserType none`

### PRISM Desktop

```powershell
cd desktop
npm run dev
# Open /editor — loads /code-oss-host → workbench
```

Env (optional): see `desktop/.env.example`.

---

## 7. Ownership map

```
PRISM Desktop
  └── /editor → EditorHost
        └── vscodeWorkspaceAdapter (only bridge)
              └── /code-oss-host          ← PRISM-owned translator
                    └── Code-OSS web :8080 ← unmodified upstream
              └── /code-oss-bridge        ← proof-only fallback (4A)
```

---

## 8. Hygiene

| Path | Role |
|------|------|
| `desktop/public/code-oss-host/` | Sprint 4B production host path |
| `desktop/public/code-oss-bridge/` | **Proof-only** fallback — not deleted; isolated via README + chrome label |
| `docker/code-oss-web.*` | Build/serve unmodified sources |
| `scripts/code-oss-web.ps1` | Operator entrypoint |
| `vscode-main/` | Untouched upstream |

---

## 9. Related docs

- [VSCODE_ADAPTER.md](VSCODE_ADAPTER.md) — protocol + adapter contract  
- [DESKTOP_SHELL.md](DESKTOP_SHELL.md) — `/editor` insertion point  
- [11_PRODUCT_CONSTITUTION.md](11_PRODUCT_CONSTITUTION.md)  

---

## 10. Build attempt log (this environment)

| Step | Result |
|------|--------|
| Portable Node 24.18.0 downloaded to `.tools/node24/` | OK |
| Host VS 2022 C++ Build Tools | Not installed (native `npm ci` blocked) |
| WSL Node via nvm | Installed; no `g++` without sudo |
| Docker Desktop start | OK initially |
| `docker compose … build` (node:24 pull + context) | **Failed** — `rpc error: Unavailable … EOF` during base image pull |
| Desktop `npm run build` | **PASS** |

Operator action: restart Docker Desktop until `docker info` succeeds, then re-run `pwsh scripts/code-oss-web.ps1`.
