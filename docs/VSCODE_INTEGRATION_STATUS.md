# VS Code / Code-OSS Integration Status

**Sprint:** 4B + Seamless PRISM IDE (2026-08-02)  
**Rule:** PRISM owns the application. Unmodified Code-OSS owns editing. The Workspace Adapter is the only bridge. Product UI never names Code-OSS, localhost, or scripts.

---

## 1. Current integration maturity

| Level | Status |
|-------|--------|
| **Shell insertion** (`/editor`) | Working — full-bleed PRISM IDE; outer chrome collapses |
| **Workspace Adapter (protocol v1)** | Working |
| **PRISM editor host** (`/code-oss-host`) | Working — sanitized errors; no URL banners |
| **Vite same-origin proxy** (`/__code-oss` → sidecar) | Working in `desktop` dev server |
| **Unmodified web workbench** | Packaged: `ensure_runtime_services`; Dev: `npm run dev:code-oss` |
| **Workbench-owned IDE panels** | Explorer · Tabs · Terminal · Problems · Search (inside engine) |
| **Open Workspace → IDE** | Default `openEditor: true` |
| **User-visible seams** | Removed (branding / localhost / Launch Code-OSS copy) |
| **Deep IWorkbench API control** | Missing (needs embedder `create()` or extension) |
| **Active editor live sync** | Partial (host echoes openFile; no live workbench events) |

**Upstream compatibility score: 95 / 100**

- Patches to `vscode-main`: **0**
- Separate Code-OSS app window: **never** — embed only
- Duplicate Monaco/Explorer/Terminal in React: **forbidden**
- Loopback HTTP sidecar: **internal only** — not shown in UI

---

## 2. Working

| Item | Evidence |
|------|----------|
| Adapter lifecycle | `idle → loading → ready \| error → disposed` |
| Protocol v1 | `desktop/src/editor/protocol.ts` |
| EditorHost | `desktop/src/editor/EditorHost.tsx` + `ensureEditorRuntime` |
| Default host path | `/code-oss-host/index.html?workbench=…` (workbench URL never displayed) |
| Open workspace | Host navigates workbench with `folder` query |
| Focus | Host focuses nested workbench iframe |
| Lifecycle ready/error | Host probes; posts `prism.editor.ready` / sanitized `error` |
| Proof bridge fallback | `/code-oss-bridge/` + `VITE_EDITOR_HOST=bridge` |
| Packaged ensure | Tauri `ensure_runtime_services` → backend + workbench sidecar |

---

## 3. Partial

| Item | Why |
|------|-----|
| **openFile** | Cross-origin host can only navigate with a `file` hint; cannot push in-memory buffers into Monaco without embedder API |
| **activeEditor** | Live `onDidChangeActiveTextEditor` is inside the workbench origin; host reports best-effort on openFile only |
| **Same-origin static workbench** | Still served via internal HTTP sidecar — product-invisible but not eliminated |

---

## 4. Missing

| Item | Planned approach (future, still zero core patches) |
|------|-----------------------------------------------------|
| Full `IWorkbench` command surface | PRISM page calls official `create()` with same-origin proxied assets, **or** thin `--extensionPath` bridge extension |
| Bidirectional dirty/save events | Same as above |
| Tauri native FS provider | WorkspaceProvider / file system provider registered by embedder options |
| Automated workbench smoke tests | Playwright against adapter contract |

---

## 5. Known upstream limitations

1. Stock workbench does not speak PRISM protocol — host translates.
2. Cross-origin iframe cannot access workbench JS APIs.
3. Windows native compile needs MSVC; Docker / `@vscode/test-web` path avoids host toolchain.
4. Web extension host runs in workers — prefer embedder `create()` for deep control.

---

## 6. Developer bring-up (not a product path)

```powershell
# Prefer unified native shell
cd desktop && npm run tauri dev

# Or Vite + sidecar
cd desktop && npm run dev
npm run dev:code-oss   # developer tooling only
```

See [DESKTOP_SHELL.md](DESKTOP_SHELL.md) and [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md) §12.
