# VS Code / Code-OSS Workspace Adapter

**Status:** Sprint 4B — Code-OSS web host  
**Product rule:** PRISM Desktop owns the application. Code-OSS owns editing. The adapter is the only bridge.

---

## 1. Ownership boundaries

| Layer | Owns | Must not own |
|-------|------|--------------|
| **PRISM Desktop** | App shell, routes, intelligence, execution, memory, Milly, commands | Workbench UI, Monaco internals, extension host |
| **Workspace Adapter** (`desktop/src/editor/`) | Lifecycle, open workspace/file, active-editor events, host URL | VS Code service injection, theme forks, AI features |
| **Code-OSS** (`vscode-main/vscode-main/`) | Editing engine (workbench, Monaco, extension host) | Product chrome, PRISM identity |
| **Bridge host** (`desktop/public/code-oss-bridge/`) | Proof-only fallback (`VITE_EDITOR_HOST=bridge`) | Default production path |
| **Code-OSS web host** (`desktop/public/code-oss-host/`) | Protocol translator → unmodified workbench iframe | Workbench UI / Monaco |

**Locked hierarchy**

```
PRISM Desktop
  └── /editor → EditorHost (iframe)
        └── Workspace Adapter  ← only bridge
              └── /code-oss-host → Code-OSS web (:8080)
              └── /code-oss-bridge (proof-only fallback)
```

Do **not** invert to “VS Code + PRISM plugin”.

---

## 2. vscode-main audit (stock Code-OSS 1.131)

| Topic | Finding |
|-------|---------|
| **Tree** | `vscode-main/vscode-main/` — upstream Code-OSS; `product.json` still “Code - OSS” |
| **Build** | Prefer Docker: `docker compose -f docker/code-oss-web.compose.yml up --build`. Native: `npm ci` → `npm run compile-web` (needs Node 24 + VS C++ on Windows) |
| **Desktop entry** | `package.json` `"main": "./out/main.js"` (Electron) |
| **Web entry** | `src/vs/workbench/browser/web.main.ts` + `web.factory.ts`; public embed facade `web.api.ts` (`IWorkbench`, `IWorkbenchConstructionOptions`) |
| **Serve web** | `./scripts/code-web` / Docker service on port **8080** |
| **Compile web** | `npm run compile-web` / `watch-web` |
| **Extension host** | Starts with workbench (web worker / remote agent paths) |
| **Monaco** | Bundled inside workbench editor services |
| **Patches** | **None** |

### Recommended Code-OSS web bring-up

```powershell
# Docker (preferred on Windows without VS Build Tools)
pwsh scripts/code-oss-web.ps1
# → http://127.0.0.1:8080/

# Desktop defaults to /code-oss-host?workbench=http://127.0.0.1:8080/
cd desktop && npm run dev
```

See [VSCODE_INTEGRATION_STATUS.md](VSCODE_INTEGRATION_STATUS.md) for maturity matrix.

---

## 3. Adapter lifecycle

```
idle → loading → ready → (openWorkspace / openFile / focus) → disposed
                ↘ error
```

| State | Meaning |
|-------|---------|
| `idle` | No iframe attached |
| `loading` | iframe attached; waiting for `prism.editor.ready` |
| `ready` | Engine accepted commands |
| `error` | Host reported `prism.editor.error` |
| `disposed` | Explicit dispose / teardown |

Singleton: `vscodeWorkspaceAdapter` in `desktop/src/editor/vscodeWorkspaceAdapter.ts`.

---

## 4. Communication protocol (v1)

All messages are JSON envelopes:

```ts
{ v: 1, type: string, requestId?: string, payload?: unknown }
```

### Parent → host

| Type | Payload |
|------|---------|
| `prism.editor.ping` | — |
| `prism.editor.openWorkspace` | `{ folderUri, name? }` |
| `prism.editor.openFile` | `{ uri, content?, language?, title? }` |
| `prism.editor.focus` | — |
| `prism.editor.dispose` | — |

### Host → parent

| Type | Payload |
|------|---------|
| `prism.editor.ready` | `{ engine: 'code-oss-bridge' \| 'code-oss-web', version? }` |
| `prism.editor.pong` | — |
| `prism.editor.activeEditor` | `{ uri, language?, dirty?, title? }` \| null |
| `prism.editor.workspaceOpened` | `{ folderUri }` |
| `prism.editor.error` | `{ message }` |

Transport: `window.postMessage` across the EditorHost iframe. PRISM never imports `vs/*` modules.

---

## 5. Startup flow

```
1. User navigates to /editor (or command palette → View Editor)
2. EditorPage mounts EditorHost
3. Adapter.resolveHostUrl()
     ├─ if VITE_CODE_OSS_URL set → that origin (Code-OSS web)
     └─ else → /code-oss-bridge/index.html (same-origin proof host)
4. iframe loads → adapter.attach(iframe) → lifecycle=loading
5. Host posts prism.editor.ready → lifecycle=ready
6. EditorPage may openWorkspace(active project) + openFile(?uri=…)
7. Host reports prism.editor.activeEditor on tab/buffer changes
8. On unmount → adapter.detach()
```

---

## 6. Files (Sprint 4A)

| Path | Role |
|------|------|
| `desktop/src/editor/protocol.ts` | Envelope + message constants |
| `desktop/src/editor/vscodeWorkspaceAdapter.ts` | Adapter singleton |
| `desktop/src/editor/EditorHost.tsx` | iframe host UI |
| `desktop/src/editor/index.ts` | Public exports |
| `desktop/public/code-oss-bridge/index.html` | Protocol-compatible proof host |
| `desktop/src/pages/EditorPage.tsx` | Route surface |
| `docs/VSCODE_ADAPTER.md` | This document |

---

## 7. Future extension points (not in 4A)

1. **Code-OSS web URL** — set `VITE_CODE_OSS_URL` after `compile-web` + `code-web`.
2. **PRISM bridge extension** (inside Code-OSS, minimal) — translate protocol ↔ `IWorkbench` / commands; keep patches zero if possible via extension only.
3. **Native FS** — map Tauri workspace paths into web FS / remote authority instead of `content` payloads.
4. **Active editor → StatusBar / Milly** — subscribe to `vscodeWorkspaceAdapter.subscribe`.
5. **Extension host policy** — decide which built-ins load; do not fork workbench chrome.

---

## 8. Explicit non-goals (locked)

- No VS Code redesign / workbench customization  
- No PRISM branding inside `product.json`  
- No editor patches unless absolutely required for embed safety  
- No new AI features in this layer  
- No backend redesign  

---

## 9. Related docs

- [DESKTOP_SHELL.md](DESKTOP_SHELL.md) — shell insertion point  
- [11_PRODUCT_CONSTITUTION.md](11_PRODUCT_CONSTITUTION.md) — product lock  
- [ARCHITECTURE_FREEZE.md](ARCHITECTURE_FREEZE.md) — hierarchy freeze  
