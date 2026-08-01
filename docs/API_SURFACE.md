# PRISM API Surface (Desktop ↔ Backend Contract)

**Status:** Canonical integration contract (Sprint 2)  
**Ownership:** Backend owns intelligence. Desktop renders state and forwards intent.  
**Envelope:** REST success responses use `{ "data": T, "meta": { "timestamp": ... } }`. The desktop client unwraps `data`.

Base URL (dev): `http://127.0.0.1:8000/api/v1`  
WebSocket: `ws://127.0.0.1:8000/api/v1/events/ws`

Source of truth for route implementations: `backend/prism/api/routes/`.  
Source of truth for desktop transport: `desktop/src/lib/api.ts`.

---

## 1. Ownership Matrix

| Domain | Backend | Desktop | Notes |
|--------|---------|---------|-------|
| Health / Ready | Implemented REST | Typed client | Liveness + storage readiness |
| Memory | Implemented REST | `memoryManager` → API | No mock memory |
| Agent (LangGraph) | Implemented REST | `agentManager` → API | Invoke path |
| Provider | Implemented REST | ProviderManager + API | Health/models/chat |
| Execution Runtime | In-process + WS events | ExecutionStore (event-driven) | **No REST control API** |
| Planner / Intent / Strategy | In-process (agent/pipeline) | Via agent invoke only | No dedicated REST |
| Trust | Field on agent response | Rendered from agent result | No dedicated REST |
| Registry (capability/skill) | In-process Mind Registry | — | **No REST** |
| Workspace | — | Local WorkspaceManager | **No backend API** |
| Events | EventBus → WS | `api.subscribe` | See §3 |

---

## 2. REST Endpoints

### 2.1 Health

| Method | Path | Request | Response `data` | Desktop method |
|--------|------|---------|-----------------|----------------|
| GET | `/health` | — | `HealthStatus` | `api.getHealth()` |
| GET | `/ready` | — | `ReadinessStatus` | `api.getReady()` |

**HealthStatus**

```json
{ "status": "healthy", "version": "0.1.0", "environment": "development", "services": {} }
```

**ReadinessStatus**

```json
{ "ready": true, "checks": { "redis": true, "qdrant": true, "neo4j": true } }
```

---

### 2.2 Memory

| Method | Path | Request | Response `data` | Desktop method |
|--------|------|---------|-----------------|----------------|
| POST | `/memory` | `MemoryCreate` | `MemoryResponse` | `api.createMemory` / `memoryManager.create` |
| GET | `/memory/{id}` | path UUID | `MemoryResponse` | `api.getMemory` / `memoryManager.get` |
| POST | `/memory/search` | `MemorySearchRequest` | `MemorySearchResult[]` | `api.searchMemories` / `memoryManager.search` |
| DELETE | `/memory/{id}` | path UUID | **204 empty** | `api.deleteMemory` / `memoryManager.delete` |

**MemoryCreate**

| Field | Type | Notes |
|-------|------|-------|
| content | string | required |
| session_id | UUID \| null | optional |
| memory_type | episodic\|semantic\|procedural\|temporal\|failure \| null | optional (classifier may assign) |
| metadata | object | default `{}` |

**MemoryResponse**

| Field | Type |
|-------|------|
| id | UUID |
| session_id | UUID \| null |
| memory_type | MemoryType |
| content | string |
| trust | float |
| mem_score | float |
| metadata | object |
| created_at / updated_at | datetime |

**MemorySearchRequest**

| Field | Type | Default |
|-------|------|---------|
| query | string | required |
| memory_types | MemoryType[] \| null | null |
| limit | int 1–100 | 10 |
| min_trust | float 0–1 | 0 |

---

### 2.3 Agent

| Method | Path | Request | Response `data` | Desktop method |
|--------|------|---------|-----------------|----------------|
| POST | `/agent/invoke` | `AgentInvokeRequest` | `AgentInvokeResponse` | `api.invokeAgent` / `agentManager.invoke` |

**AgentInvokeRequest:** `{ "message": string, "session_id"?: UUID }`

**AgentInvokeResponse**

| Field | Type |
|-------|------|
| final_answer | string \| null |
| plan | string \| null |
| reasoning | string \| null |
| reflection | string \| null |
| trust_score | float |
| retrieved_memories | object[] |
| healing_actions | object[] |
| errors | string[] |

Runs LangGraph: Planner → Retrieval → Reasoning → Reflection → Trust → Healing.  
Does **not** currently drive `ExecutionRuntime` sessions (no `runtime.*` WS events from this path alone).

---

### 2.4 Provider

| Method | Path | Request | Response `data` | Desktop method |
|--------|------|---------|-----------------|----------------|
| GET | `/provider/health` | — | `ProviderHealth` | `api.getProviderHealth` |
| GET | `/provider/models` | — | `ModelInfo[]` | `api.getProviderModels` |
| POST | `/provider/chat` | `ChatRequestBody` | `ChatResponse` | `api.providerChat` |

**ChatRequestBody:** `messages` **or** `message`, optional `provider`, `model`, `temperature`, `max_tokens`.

---

### 2.5 Not exposed over HTTP (implemented in-process only)

| Capability | Location | Status |
|------------|----------|--------|
| Cognitive Planner / Intent / Goal / Strategy | `prism/core/*` | Implemented, no REST |
| Tool Orchestrator | `prism/core/tool_orchestrator.py` | Implemented, no REST |
| ExecutionRuntime start/pause/resume | `prism/core/execution_runtime.py` | Implemented, **no REST** |
| Capability / Skill Registry | `prism/core/capability.py`, `skill.py` | Implemented, **no REST** |
| Trust Engine (standalone) | PlaceholderSubsystem + agent trust node | Partial |
| Workspace CRUD | — | Desktop-local only |

---

## 3. WebSocket Events

### 3.1 Transport

- Connect: `WS /api/v1/events/ws`
- Default subscription: `*` (all events)
- Client control: `{ "action": "subscribe"|"unsubscribe", "event_type": "..." }`
- Server frame: `{ "event_type": string, "data": any }`

### 3.2 Emitted today (inventory)

| Event type | Publisher | Payload (`data`) | Desktop consumer |
|------------|-----------|------------------|------------------|
| `kernel_boot` | `kernel.py` | `{ "status": "success" }` | kernelStore, notifications |
| `kernel_shutdown` | `kernel.py` | `{ "status": "shutting_down" }` | kernelStore |
| `runtime.<ExecutionEventType>` | `execution_runtime.py` | `ExecutionEvent.model_dump()` | executionStore, graphEngine, toolManager |

**`runtime.*` subtypes (when ExecutionRuntime runs):**  
`session_created`, `session_queued`, `session_started`, `session_paused`, `session_resumed`, `session_retrying`, `session_succeeded`, `session_failed`, `session_cancelled`, `session_completed`, `task_started`, `task_succeeded`, `task_failed`, `task_skipped`, `artifact_registered`, `progress_updated`, `retry_scheduled`, `cancellation_requested`

### 3.3 Documented historically but **not emitted**

Do not invent these until a publisher exists:

| Speculative name (old docs) | Reality |
|-----------------------------|---------|
| `kernel.ready` / `kernel.booting` | Use `kernel_boot` / `kernel_shutdown` |
| `memory.stored` / `memory.decayed` | Memory API has no EventBus publish |
| `execution.started` / `task.completed` | Use `runtime.session_*` / `runtime.task_*` |
| `tool.started` / `tool.error` | Covered by `runtime.task_*` when runtime runs |
| `workspace.*` | Desktop-local only; not from backend |

---

## 4. Desktop client map

| Module | Role |
|--------|------|
| `desktop/src/lib/api.ts` | Typed HTTP + WS transport |
| `desktop/src/lib/memory.ts` | MemoryManager + MemoryStore → backend |
| `desktop/src/lib/agent.ts` | AgentManager + AgentStore → `/agent/invoke` |
| `desktop/src/lib/store.ts` | Kernel / Workspace / Execution / Notification; WS routing |
| `desktop/src/lib/providers.ts` | Client provider catalog + `/provider/health` |
| `desktop/src/lib/defaultCommands.ts` | Palette actions: health, ready, memory search, agent invoke |

---

## 5. Missing endpoints (v1 gaps — not invented this sprint)

1. ExecutionRuntime REST: create session, pause, resume, cancel, get session  
2. Registry REST: capabilities, skills  
3. Workspace sync REST (if multi-device needed)  
4. Memory EventBus publishes (optional UX)  
5. Agent invoke → ExecutionRuntime bridge (so WS mirrors agent runs)

---

## 6. Change policy

- Prefer extending this document when adding routes or events.
- Do not add desktop business logic that duplicates backend services.
- Keep TypeScript types aligned with Pydantic models in `backend/prism/`.
