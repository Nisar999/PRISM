# PRISM Desktop

**PRISM v0.9.0 Alpha** — Native desktop shell for the PRISM AI platform.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Tauri v2 | Native desktop runtime |
| React 19 | UI framework |
| TypeScript | Type-safe development |
| Vite | Build tooling |
| TailwindCSS | Utility-first styling |
| shadcn/ui | Component primitives |

## Architecture

The desktop follows a **Manager → Store → Hook** pattern:

- **Manager** — Stateless service class with public methods
- **Store** — Extends `Store<State>`, owns reactive state, notifies subscribers
- **Hook** — `useSyncExternalStore` binding consumed by React components

### Service Layer (`src/lib/`)

| Service | File | Purpose |
|---------|------|---------|
| State Layer | `store.ts` | Base Store class, KernelStore, ExecutionStore, NotificationStore |
| Command Registry | `commands.ts` | Command registration, fuzzy search, keybinding parser |
| Default Commands | `defaultCommands.ts` | Built-in navigation and system commands |
| Layout Engine | `layout.ts` | Panel registry, dock model, split layout tree |
| Workspace Manager | `workspace.ts` | Project/Session/Artifact CRUD, import/export |
| Graph Engine | `graph.ts` | Node/edge model, topological layout |
| Identity Engine | `identity.ts` | Local user profile, preferences |
| Provider Manager | `providers.ts` | Provider definitions, status, health |
| Tool Runtime | `tools.ts` | Tool registration, lifecycle, logging |
| Milly Engine | `milly.ts` | Cognitive presence state machine |
| Settings Manager | `settings.ts` | Category-based settings, validation |
| Plugin SDK | `plugins.ts` | Manifest lifecycle, capability registration |
| API Client | `api.ts` | Backend HTTP/WebSocket communication |

### Components (`src/components/`)

| Component | File | Purpose |
|-----------|------|---------|
| Command Palette | `CommandPalette.tsx` | `Ctrl+K` overlay with fuzzy search |
| Graph Canvas | `GraphCanvas.tsx` | SVG execution graph with pan/zoom |
| Milly Renderer | `MillyRenderer.tsx` | Animated cognitive presence |
| Workspace Explorer | `WorkspaceExplorer.tsx` | Project/session/artifact browser |
| App Shell | `layout/AppShell.tsx` | Root layout with sidebar and toolbar |
| Sidebar | `layout/Sidebar.tsx` | Navigation sidebar |
| Top Toolbar | `layout/TopToolbar.tsx` | Header toolbar |
| Status Bar | `layout/StatusBar.tsx` | Bottom status bar |

### Pages (`src/pages/`)

| Page | File | Purpose |
|------|------|---------|
| Dashboard | `Dashboard.tsx` | Kernel status, workspace, execution overview |
| Settings | `Settings.tsx` | Searchable categorized settings |
| Placeholder | `Placeholder.tsx` | Placeholder for future routes |

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type check and build
npm run build
```

## Bootstrap Sequence

The application initializes in `main.tsx`:

1. `initializeStateLayer()` — WebSocket connection, store hydration
2. `registerDefaultCommands()` — Navigation and system commands
3. `identityManager.bootstrap()` — User profile
4. `settingsManager.bootstrap()` — Configuration
5. `providerManager.bootstrap()` — Model providers
6. `millyEngine.startSync()` — Cognitive presence sync
7. `pluginManager.bootstrap()` — Plugin loading
