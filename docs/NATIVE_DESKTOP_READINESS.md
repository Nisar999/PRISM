# PRISM v1 — Native Desktop Readiness

**Date:** 2026-07-29  
**Architecture impact:** ZERO (existing managers/workflows only; Tauri OS plugins + settings fields)

---

## 1. Root cause(s)

| # | Root cause | Impact |
|---|------------|--------|
| 1 | **Open Folder used `window.prompt`** — no native folder dialog | Not a normal Windows app UX |
| 2 | **No File → Open Folder / Recents / Close** — TitleBar menus only opened the palette | Folder open was undiscoverable |
| 3 | **No drag-and-drop folder open** | Standard desktop open path missing |
| 4 | **No last-workspace / recent persistence** | Cold start always empty |
| 5 | **Shell layout not restored** despite `restoreLastLayout` flag | Layout flag was honesty-only |
| 6 | **Backend (:8000) + Code-OSS (:8080) not started by the exe** | User had to run uvicorn/npm/PowerShell manually |
| 7 | **StatusBar `getSnapshot` unstable** (fixed in UX-1) | Infinite React loop on shell mount |
| 8 | **Tauri 0.9.0 / incomplete NSIS story** | Release packaging unclear |

---

## 2. Fixes applied

### Workspace open flow
- Added `@tauri-apps/plugin-dialog` + `tauri-plugin-dialog`
- `pickWorkspaceFolder()` → native Open Folder dialog (prompt fallback in browser)
- `workspace:open` → **Open Folder** (Ctrl+O)
- `workspace:open-path` → recent / drag-drop
- **File** menu: Open Folder, Open Demo, Open Recent, Close Folder, Settings
- Tauri **drag-drop** → `workspace:open-path` via existing `runOpenWorkspaceWorkflow`
- After successful open → `rememberWorkspacePath` via **settingsManager**

### Persistence (settingsManager — no new store)
- `AppSettings.workspace`: `lastPath`, `recentFolders`, `restoreOnLaunch`
- `AppSettings.shell`: agent/bottom sizes + panel open flags
- `AppSettings.session`: PRISM center panes (Milly views)
- Boot: hydrate shell + panes → `restoreLastWorkspaceIfEnabled()`
- Resize debounced → `persistShellLayout()`

### Startup (no visible terminals)
- Release already uses `windows_subsystem = "windows"` (no console)
- New Rust command `ensure_runtime_services`:
  - If `:8000` down → start `backend/.venv/Scripts/python.exe -m uvicorn …` with **CREATE_NO_WINDOW**
  - If `:8080` down → start Code-OSS `code-web.js` (or docker compose `-d`) with **CREATE_NO_WINDOW**
  - Invoked once from `main.tsx` when running under Tauri
- Requires repo layout discoverable (`PRISM_ROOT` or walk from exe/cwd)

### Packaging
- `tauri.conf.json` version **1.0.0**, bundle target **nsis**
- Cargo package version **1.0.0**

### Key files
| Path | Role |
|------|------|
| `desktop/src/lib/nativeFolder.ts` | Native dialog bridge |
| `desktop/src/lib/sessionRestore.ts` | Recent / restore / shell hydrate |
| `desktop/src/lib/settings.ts` | Extended AppSettings |
| `desktop/src/lib/defaultCommands.ts` | Open Folder commands |
| `desktop/src/components/layout/TitleBar.tsx` | File menu |
| `desktop/src/components/layout/AppShell.tsx` | DnD + layout persist |
| `desktop/src/main.tsx` | Boot restore + ensure runtime |
| `desktop/src-tauri/src/lib.rs` | `ensure_runtime_services`, dialog plugin |

---

## 3. Remaining blockers

| Blocker | Severity | Notes |
|---------|----------|-------|
| **Self-contained installer** (Python + Code-OSS bundled as sidecars) | ~~Critical~~ → **Done in RELEASE-2** | See `docs/RELEASE2_SELF_CONTAINED_INSTALLER.md` |
| **Code-OSS Explorer/Tabs/Terminal** depend on `:8080` workbench | High | If Code-OSS fails to start, editor shows host error |
| **Full E2E on installed NSIS** (Open→Edit→Save→Reopen) | High | Requires successful `tauri build` + manual smoke on target machine |
| **Code-OSS tab persistence** | Medium | Owned by workbench, not PRISM settings |
| **C: disk space** for default cargo target | Medium | Prefer `CARGO_TARGET_DIR` on D: |

---

## 4. Production build result

| Artifact | Path | Size |
|----------|------|------|
| Release binary | `D:\cargo-target\prism-desktop\release\desktop.exe` | ~18.9 MB |
| NSIS installer | `D:\cargo-target\prism-desktop\release\bundle\nsis\PRISM_1.0.0_x64-setup.exe` | ~11.5 MB |

- Frontend `npm run build`: **PASS**
- `npm run tauri -- build`: **PASS** (exit 0)
- Smoke launch `desktop.exe`: **PASS** (process stayed up; no console window)

Installer product name: **PRISM** (`productName` in `tauri.conf.json`). Installed binary name follows NSIS/productName (**PRISM.exe** after setup).

### Validation checklist (manual after install)

| Check | Expected |
|-------|----------|
| Launch PRISM.exe | Window opens; no console; no npm prompt |
| File → Open Folder | Native dialog; project loads; navigates `/editor` |
| Drag-drop folder | Same open workflow |
| Explorer populates | Code-OSS Explorer when `:8080` up |
| Open / edit / save file | Code-OSS workbench |
| Close + reopen | Last folder restored when `restoreOnLaunch` true |
| Open Recent | File menu lists persisted paths |

---

## Architecture

- **No** new managers, stores, or backend APIs
- Reuses `workspaceManager`, `runOpenWorkspaceWorkflow`, `settingsManager`, `vscodeWorkspaceAdapter`
- Dialog / silent process spawn are OS shell bridges only
