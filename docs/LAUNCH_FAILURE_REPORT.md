# Launch Failure Report — Sprint 6A

**Date:** 2026-07-27  
**Symptom:** White screen at http://127.0.0.1:1420/ — `#root` empty, React not rendering  
**Scope:** Restore rendering only. Architecture frozen. No new features.

---

## Root cause

**Circular module dependency → Temporal Dead Zone crash on boot.**

| Module | Imports |
|--------|---------|
| `desktop/src/lib/store.ts` | `toolManager` from `./tools` (static) |
| `desktop/src/lib/tools.ts` | `Store`, `notificationStore` from `./store` |

Load order: `main.tsx` → `initializeStateLayer` / stores → `store.ts` begins evaluating → pulls `tools.ts` → `tools.ts` needs `Store` from `store.ts` **before** `class Store` is initialized.

---

## Stack trace (captured via headless Chromium)

```
ReferenceError: Cannot access 'Store' before initialization
    at http://127.0.0.1:1420/src/lib/tools.ts:3:25
```

**Page state before fix:**
- `#root` exists
- `childCount: 0`
- `innerHTML: ""`
- No AppShell DOM

---

## Why the screen was blank

1. Vite served HTML + `main.tsx` successfully (HTTP 200).
2. Module evaluation threw **before** `ReactDOM.createRoot(...).render(...)`.
3. React never mounted → empty white `#root`.
4. Not CSS, not routing, not Splash, not branding assets.

---

## Fix

**File changed:** `desktop/src/lib/store.ts` only.

- Removed static `import { toolManager } from './tools'`.
- Forward runtime events with a lazy dynamic import:

```ts
void import('./tools').then(({ toolManager }) => {
  toolManager.handleRuntimeEvent(runtimeEvent as ExecutionEvent);
});
```

Breaks the cycle; `Store` initializes before `tools.ts` runs. No new managers, no API redesign.

---

## Verification (after fix)

| Check | Result |
|-------|--------|
| `pageerror` | none |
| `#root` children | ≥ 1 |
| `#root` HTML length | ~32k |
| Sidebar (`aside`) | present |
| Main | present |
| StatusBar (`footer`) | present |
| Visible copy | Dashboard nav, Workspace Explorer, PRISM branding |

AppShell renders at http://127.0.0.1:1420/.

---

## Ruled out

- Backend / Vite availability  
- `BrowserRouter` / routes / `Outlet`  
- Splash overlay stuck (never reached)  
- Branding PNG imports  
- Theme / z-index / `display:none`  
- GraphCanvas / ExecutionDock (never mounted)
