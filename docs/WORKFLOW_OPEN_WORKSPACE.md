# Workflow 1 — Open Workspace

**Milestone:** Beta Milestone 1 (updated — Seamless PRISM IDE)  
**Status:** Wired end-to-end via existing managers  
**Entry:** `runOpenWorkspaceWorkflow()` in `desktop/src/lib/workflows/openWorkspace.ts`

---

## Sequence

```
User (Explorer / Cmd+K / Open Folder / Launch PRISM IDE)
  → runOpenWorkspaceWorkflow(path)   // openEditor defaults true
      → executionStore + graphEngine          (session + step nodes)
      → workspaceManager.loadProject|create  (active project)
      → navigate /editor?folder=…            (PRISM IDE)
      → ensureEditorRuntime (native)         (silent sidecar bring-up)
      → vscodeWorkspaceAdapter.openWorkspace (when host READY)
      → memoryManager.search                 (IntelligenceRail Memory)
      → agentManager.invoke                  (Thoughts + summary)
      → StatusBar                            (project / memory / Editor ready)
      → graphEngine edges                    (workflow DAG)
```

---

## Components involved

| Step | Owner | Existing API |
|------|-------|--------------|
| Choose workspace | Desktop UI | WorkspaceExplorer / commands / WorkspacePage |
| Open project | WorkspaceManager | `loadProject` / `createProject` |
| Open PRISM IDE | Workspace Adapter | `vscodeWorkspaceAdapter.openWorkspace` |
| Editor loads folder | EditorPage + EditorHost | `?folder=` + activeProject |
| Memory search | MemoryManager | `search` → backend |
| Project summary | AgentManager | `invoke` → `final_answer` |
| Thoughts panel | IntelligenceRail / ThoughtsPage | `agentStore.lastResponse` |
| Status bar | StatusBar | `useWorkspace` / `useMemory` / editor lifecycle |
| Execution graph | GraphEngine + ExecutionStore | `handleRuntimeEvent` / `setEdge` |

---

## How to run

### Packaged desktop
1. Launch `PRISM Desktop.exe` (runtime services auto-start).
2. Open Folder (or Launch PRISM IDE → Open Folder).
3. Observe: `/editor` opens as PRISM IDE; no localhost or vendor branding.

### Development
1. Start backend for memory + agent steps.
2. `cd desktop && npm run tauri dev` (preferred) **or** `npm run dev` + `npm run dev:code-oss`.
3. Command Palette → **Open Folder**.
4. Observe: `/editor` opens; StatusBar shows **Editor ready** when the host is up.

---

## Known limitations

| Gap | Notes |
|-----|-------|
| Editing-engine sidecar | Internal HTTP workbench may still bind on loopback — never shown in UI |
| Live activeEditor from workbench | Cross-origin adapter limitation |
| Memory empty on fresh install | Summary still runs from project metadata |
| Soft-fail memory/agent | Workspace + IDE still open if backend offline |

---

## Architecture compliance

- No new backend routes
- No VS Code / Code-OSS product patches
- No duplicate memory/agent logic
- Adapter remains the only editor bridge
- Do not rebuild Explorer / Tabs / Terminal / Problems / Search in React
