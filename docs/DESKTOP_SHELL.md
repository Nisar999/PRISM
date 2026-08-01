# PRISM Desktop Shell

**Status:** v1 IDE shell (Figma `434:2`) + Code-OSS editing engine  
**Product:** Agentic Intelligent Workspace ([11_PRODUCT_CONSTITUTION.md](11_PRODUCT_CONSTITUTION.md))  
**Rule:** PRISM Desktop owns the product chrome. Unmodified Code-OSS owns editing UX (Explorer, Tabs, Terminal, Problems, Search) via the Workspace Adapter.

---

## 1. Layout hierarchy (approved)

```
AppShell                          bg #131313
├── TitleBar                      40px  · File Edit Selection View Go Run Help
├── BodyRow
│   ├── ActivityBar               52px  · (hidden on /editor)
│   ├── Sidebar (resizable)       WorkspaceExplorer · (hidden on /editor)
│   ├── CenterColumn
│   │   ├── Editor area           Welcome (/) · Conversation · /editor → Code-OSS
│   │   └── ExecutionDock         Output / Graph / Review · (hidden on /editor)
│   └── Agent panel (resizable)   IntelligenceRail (Chat / Thoughts / Memory / Context)
├── StatusBar                     24px · includes Code-OSS adapter state
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
| Editor + IDE panels | `/editor` → `EditorHost` → Code-OSS | **Code-OSS**: Explorer, Editor, Tabs, Terminal, Problems, Search |
| Right agent | `IntelligenceRail` | Chat / Thoughts / Memory / Context (agentStore · memoryStore · executionStore) |
| Execution dock | `ExecutionDock` | PRISM Graph / Output / Review (not the system terminal) |
| Status bar | `StatusBar` | Existing stores + adapter |

On `/editor`, PRISM collapses ActivityBar / Sidebar / ExecutionDock so Code-OSS is the central IDE. Chrome visibility + sizes: `desktop/src/lib/shellUi.ts`.

---

## 2. Canonical routes

| Path | Center content |
|------|----------------|
| `/` | `EditorWelcome` (shortcut list) |
| `/conversation` | Conversation / ChatHub |
| `/workspace` | Workspace page |
| `/editor` | **Code-OSS workbench** via EditorHost (iframe host already required) |
| `/settings` | Cursor-style Settings (General · Appearance · Models · Providers · Mirror) |
| `/memory` `/thoughts` `/chat` `/context` `/planning` `/execution` `/review` | Contextual panel routes |

Archived: `/about` `/runtime` `/registries` → redirects; `/models` → `/settings`.

---

## 3. Welcome shortcuts (Figma)

| Action | Keys | Behavior |
|--------|------|----------|
| New Agent | Ctrl+Shift+L | Open conversation + agent panel |
| Show Terminal | Ctrl+J | Open bottom Output dock (PRISM execution) |
| Search Files | Ctrl+P | Command palette |
| Open Browser | Ctrl+Shift+B | Command palette |
| Maximize Chat | Ctrl+Alt+E | Conversation + agent panel |
| Add Folder | Ctrl+Alt+A | `workspace:open` |

---

## 4. VS Code insertion point

**Mount:** `/editor` → `EditorHost` → `/code-oss-host` → Code-OSS web (`/__code-oss/` proxy → `:8080`).

- Do **not** launch a separate Code-OSS application window.
- Do **not** rebuild Monaco / Explorer / Terminal / Problems / Search in React.
- Outer product chrome remains PRISM; editing UX remains Code-OSS.

Bring-up: `pwsh scripts/code-oss-web.ps1` then open `/editor`.

---

## 5. Related docs

- [VSCODE_ADAPTER.md](VSCODE_ADAPTER.md)
- [VSCODE_INTEGRATION_STATUS.md](VSCODE_INTEGRATION_STATUS.md)
- [11_PRODUCT_CONSTITUTION.md](11_PRODUCT_CONSTITUTION.md)
