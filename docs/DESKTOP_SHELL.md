# PRISM Desktop Shell

**Status:** v1 Seamless PRISM IDE (Figma `434:2`) + editing engine  
**Product:** Agentic Intelligent Workspace ([11_PRODUCT_CONSTITUTION.md](11_PRODUCT_CONSTITUTION.md))  
**Rule:** PRISM Desktop owns the product chrome. The unmodified editing engine owns editing UX (Explorer, Tabs, Terminal, Problems, Search) via the Workspace Adapter. Users never see engine vendor branding, localhost, or a separate app launch.

---

## 1. Layout hierarchy (approved)

```
AppShell                          bg #131313
├── TitleBar                      40px  · File Edit Selection View Go Run Help
├── BodyRow
│   ├── ActivityBar               52px  · (hidden on /editor)
│   ├── Sidebar (resizable)       WorkspaceExplorer · (hidden on /editor)
│   ├── CenterColumn
│   │   ├── Editor area           Welcome (/) · Conversation · /editor → PRISM IDE
│   │   └── ExecutionDock         Output / Graph / Review · (hidden on /editor)
│   └── Agent panel (resizable)   IntelligenceRail (Chat / Thoughts / Memory / Context)
├── StatusBar                     24px · includes Editor ready / starting
├── CommandPalette
└── NotificationToasts
```

Source: Figma file `gWywhA1FoZfyEDSkhHI9Zx` node `434:2`.

### Regions

| Region | Component | Ownership |
|--------|-----------|-----------|
| Top menu | `TitleBar` | Desktop |
| Activity bar | `ActivityBar` | Desktop (product nav) |
| Workspace panel | `Sidebar` → `WorkspaceExplorer` | Desktop WorkspaceManager (sessions/artifacts — **not** file Explorer) |
| Editor + IDE panels | `/editor` → `EditorHost` → editing engine | **Editing engine**: Explorer, Editor, Tabs, Terminal, Problems, Search |
| Right agent | `IntelligenceRail` | Chat / Thoughts / Memory / Context (agentStore · memoryStore · executionStore) |
| Execution dock | `ExecutionDock` | PRISM Graph / Output / Review (not the system terminal) |
| Status bar | `StatusBar` | Existing stores + adapter |

On `/editor`, PRISM collapses ActivityBar / Sidebar / ExecutionDock / Agent rail so the IDE editing region is full-bleed. Chrome visibility + sizes: `desktop/src/lib/shellUi.ts`.

---

## 2. Canonical routes

| Path | Center content |
|------|----------------|
| `/` | `EditorWelcome` (shortcut list) |
| `/conversation` | Conversation / ChatHub |
| `/workspace` | Workspace page |
| `/editor` | **PRISM IDE** via EditorHost (adapter + internal workbench host) |
| `/settings` | Cursor-style Settings (General · Appearance · Models · Providers · Milly · Mirror) |
| `/memory` `/thoughts` `/chat` `/context` `/planning` `/execution` `/review` | Contextual panel routes |

Archived: `/about` `/runtime` `/registries` → redirects; `/models` → `/settings`.

---

## 3. Primary user flow

```
Splash → Authentication → Conversation Hub → Open Workspace → PRISM IDE (/editor)
```

`runOpenWorkspaceWorkflow` defaults `openEditor: true` and navigates to `/editor?folder=…`.  
Packaged app calls `ensure_runtime_services` / `ensureEditorRuntime` silently — no manual workbench start for users.

---

## 4. Welcome shortcuts (Figma)

| Action | Keys | Behavior |
|--------|------|----------|
| New Agent | Ctrl+Shift+L | Open conversation + agent panel |
| Show Terminal | Ctrl+J | Open bottom Output dock (PRISM execution) |
| Search Files | Ctrl+P | Command palette |
| Open Browser | Ctrl+Shift+B | Command palette |
| Maximize Chat | Ctrl+Alt+E | Conversation + agent panel |
| Add Folder | Ctrl+Alt+A | `workspace:open` → IDE |

---

## 5. Editing-engine insertion point

**Mount:** `/editor` → `EditorHost` → `/code-oss-host` → internal workbench (dev: Vite `/__code-oss/` proxy; packaged: loopback sidecar started by Tauri).

- Do **not** launch a separate application window.
- Do **not** rebuild Monaco / Explorer / Terminal / Problems / Search in React.
- Do **not** expose localhost, vendor names, or script paths in product UI.
- Outer product chrome remains PRISM; editing UX remains the engine.

**Developer-only bring-up** (never shown in UI): `npm run dev:code-oss` beside Vite when not using `tauri dev`.

---

## 6. Related docs

- [VSCODE_ADAPTER.md](VSCODE_ADAPTER.md)
- [VSCODE_INTEGRATION_STATUS.md](VSCODE_INTEGRATION_STATUS.md)
- [WORKFLOW_OPEN_WORKSPACE.md](WORKFLOW_OPEN_WORKSPACE.md)
- [11_PRODUCT_CONSTITUTION.md](11_PRODUCT_CONSTITUTION.md)
- [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md) §12
