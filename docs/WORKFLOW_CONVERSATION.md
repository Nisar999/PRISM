# Workflow — Conversation Engine

**Milestone:** Beta Milestone 3 · Capability 1  
**Entry:** `runConversationTurn()` in `desktop/src/lib/workflows/conversation.ts`  
**Surface:** `/conversation` · ConversationPage

---

## Sequence

```
User (Conversation page)
  → detectIntent (desktop routing)
  → memoryManager.search
  → context assembly (workspace + provider + memory)
  → agentManager.invoke (backend planner/reasoner)
  → agentStore → Thoughts / Planning
  → executionStore + graphEngine (workflow DAG)
  → memoryManager.create (Q/A persistence)
  → workspaceManager.upsertArtifact (session history)
  → StatusBar / Milly presence
```

---

## Components

| Step | Existing owner |
|------|----------------|
| Intent | `detectIntent` in workflow (not a manager) |
| Memory retrieval | `memoryManager` |
| Context | `workspaceStore` + `providerStore` |
| Agent / plan / reason | `agentManager` → backend |
| Thoughts | `agentStore` / Thoughts page |
| Graph | `graphEngine` + `executionStore` |
| History | `workspaceManager.upsertArtifact` |
| UI | `ConversationPage` (shell route) |

**No new managers.**

---

## Rules

- Conversation is a first-class shell surface — not a floating chatbot.
- History belongs to the active workspace session (`conversation_<sessionId>` artifact).
- Backend owns intelligence; desktop orchestrates existing clients only.

---

## How to validate

1. Backend up · desktop `npm run dev`
2. Open Demo Workspace
3. Navigate to **Conversation**
4. Ask a question
5. Confirm: Memory rail updates, Thoughts fill, Execution graph shows `conv.*` steps, reply appears, history reloads after refresh
