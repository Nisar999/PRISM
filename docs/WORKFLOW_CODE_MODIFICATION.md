# Workflow — Code Modification Engine

**Milestone:** Beta Milestone 4 · Capability 2  
**Entry:** `runCodeModification()` in `desktop/src/lib/workflows/codeModification.ts`  
**Surfaces:** Conversation (`code_mod` intent) → `/review` · Execution dock **Code Review** tab

---

## Sequence

```
User (Conversation — modify / edit / fix / refactor…)
  → detectIntent → code_mod
  → memoryManager.search
  → workspace context assembly
  → agentManager.invoke (edit plan + structured file proposals)
  → parse agent output OR demo fallback (prism-edit-demo.md)
  → snapshot originals (in-memory) + generate unified diffs
  → workspaceManager.upsertArtifact (type: diff)
  → codeReviewStore (pending proposal — no disk write yet)
  → Code Review panel (unified diff · file tree · +/-)
  → Accept All / Accept file  OR  Reject All
  → workspaceManager.writeProjectFile (only after Accept)
  → on apply failure: restore snapshots (transactional rollback)
  → memoryManager.create (decision outcome)
  → Diff outcome artifact + execution graph (mod.*)
  → optional Rollback last apply
```

---

## Managers involved

| Step | Owner |
|------|--------|
| Intent | `detectIntent` in Conversation workflow (not a manager) |
| Memory search / outcome | `memoryManager` |
| Context / project files | `workspaceManager` + `workspaceStore` |
| Plan / propose | `agentManager` → backend |
| Graph / pipeline | `graphEngine` + `executionStore` |
| Editor refresh (optional later) | Workspace Adapter `openFile` |
| Status | StatusBar · Milly · `shellUiStore` |

**Helpers (not managers):** `patch.ts`, `codeReviewStore`

**No new managers. No backend redesign.**

---

## Approval flow

1. Proposal is always **pending** when diffs appear.
2. Disk writes happen **only** inside `acceptCodeModifications`.
3. **Accept All** — mark pending → write all → complete proposal → memory `accepted`.
4. **Accept file** — write one path; leave other pending files in review.
5. **Reject All** — discard proposal → no writes → memory `rejected`.
6. Never auto-apply.

---

## Rollback strategy

| Phase | Behavior |
|-------|----------|
| Before Accept | No writes; Reject drops proposal |
| During Accept | On write failure, restore already-written files from original snapshots |
| After Accept | **Rollback last apply** restores `appliedSnapshots` from last accepted proposal |

---

## Diff lifecycle

```
propose → (agent parse | demo) → FilePatch[] + unifiedDiff
  → Diff artifact (session)
  → Review UI (pending)
  → accepted | rejected
  → Diff outcome artifact + episodic memory
  → (optional) rolled_back
```

---

## How to validate

1. Backend optional (demo fallback works offline) · desktop `npm run dev`
2. **Open Demo Workspace**
3. Conversation → e.g. `Modify the project: add a short notes file`
4. Confirm Code Review shows unified diff + file tree
5. **Accept All** → `prism-edit-demo.md` (or agent paths) written under project
6. Memory / Execution graph show `mod.*` steps and outcome
7. **Rollback last apply** restores originals
