# Workflow 1 — Open Workspace

**Milestone:** Beta Milestone 1  
**Status:** Wired end-to-end via existing managers  
**Entry:** `runOpenWorkspaceWorkflow()` in `desktop/src/lib/workflows/openWorkspace.ts`

---

## Sequence

```
User (Explorer / Cmd+K / Workspace page)
  → runOpenWorkspaceWorkflow(path)
      → executionStore + graphEngine          (session + step nodes)
      → workspaceManager.loadProject|create  (active project)
      → navigate /editor?folder=…            (EditorPage + Adapter)
      → vscodeWorkspaceAdapter.openWorkspace (if host already ready)
      → memoryManager.search                 (IntelligenceRail Memory)
      → agentManager.invoke                  (Thoughts + Dashboard summary)
      → StatusBar                            (project / memory / runtime)
      → graphEngine edges                    (workflow DAG)
```

---

## Components involved

| Step | Owner | Existing API |
|------|-------|--------------|
| Choose workspace | Desktop UI | WorkspaceExplorer / commands / WorkspacePage |
| Open project | WorkspaceManager | `loadProject` / `createProject` |
| Open Code-OSS | Workspace Adapter | `vscodeWorkspaceAdapter.openWorkspace` |
| Editor loads folder | EditorPage + EditorHost | `?folder=` + activeProject |
| Memory search | MemoryManager | `search` → backend |
| Project summary | AgentManager + Dashboard | `invoke` → `final_answer` |
| Thoughts panel | IntelligenceRail / ThoughtsPage | `agentStore.lastResponse` |
| Status bar | StatusBar | `useWorkspace` / `useMemory` / `useExecution` |
| Execution graph | GraphEngine + ExecutionStore | `handleRuntimeEvent` / `setEdge` |

---

## How to run

1. Start backend (`uvicorn prism.main:create_app --factory …`) for memory + agent steps.
2. `cd desktop && npm run dev`
3. Command Palette → **Open Demo Workspace** (or sidebar **Open Demo Workspace**).
4. Observe: `/editor` opens, Memory rail fills, Thoughts updates, StatusBar project label, Execution dock graph steps.

---

## Missing links (known)

| Gap | Notes |
|-----|-------|
| Full Code-OSS web on `:8080` | Host may show unreachable until `scripts/code-oss-web.ps1` succeeds |
| Live activeEditor from workbench | Cross-origin adapter limitation (Sprint 4B) |
| Memory empty on fresh install | Backend has no prior project memories — summary still runs from project metadata |
| Soft-fail memory/agent | Workspace + editor still open if backend offline |

---

## Architecture compliance

- No new backend routes
- No VS Code patches
- No duplicate memory/agent logic
- Adapter remains the only editor bridge
