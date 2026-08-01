# PRISM Desktop — Sprint R3A Provider Activation Investigation

Last updated: 2026-07-27

**Architecture impact:** ZERO (logging, bootstrap ordering, settings URL wiring, error handling in existing `ProviderManager` only).

---

## Symptom

Toast **"Provider Activation Failed"** while Ollama is healthy (`GET http://127.0.0.1:11434/api/tags` succeeds outside PRISM).

---

## Activation path (trace)

| Step | Location | What happens |
| --- | --- | --- |
| 1 | `main.tsx` | `identityManager.bootstrap()` → `settingsManager.bootstrap()` → `providerManager.bootstrap()` (sequenced after R3A) |
| 2 | `settings.ts` `load()` | Reads `localStorage` key `prism_app_settings` (`preferredProviderId`, `ollamaEndpoint`) |
| 3 | `providers.ts` `bootstrap()` | Picks `targetId` from identity profile, else settings, else `ollama` |
| 4 | `providers.ts` `selectProvider()` | `status: checking` → `checkProviderHealth()` → optional `saveActiveProfile` → `setActiveProvider` → success toast |
| 5 | `providers.ts` `checkProviderHealth('ollama')` | **Direct** `fetch` to `{base}/api/tags` for each base, then fallback `api.getProviderHealth()` |
| 6 | `api.ts` `getProviderHealth()` | `GET http://127.0.0.1:8000/api/v1/provider/health` (unwraps `{ data, meta }`) |
| 7 | Backend | `LiteLLMProvider.health()` — LiteLLM `acompletion` ping using `OLLAMA_BASE_URL` from backend `.env` |

**ProviderStore** only holds state; **ProviderManager** performs activation.

---

## 1. Exact failing line (historical + residual)

### Primary root cause (pre–R3 / still if build is stale)

**File:** `desktop/src/lib/providers.ts`  
**Historical failure:** `checkProviderHealth()` called **only** `api.getProviderHealth()` with no Ollama direct probe.  
**Historical toast:** `selectProvider` `catch` → `message: 'Provider Activation Failed'` (removed in R3).

**Equivalent failure today:** `checkProviderHealth` → `throw new Error(message)` at end of `catch` (~line 360+) when both Ollama probe and backend fail; `selectProvider` `catch` shows **Local AI offline** (not the old string).

### Secondary bug (could fail with healthy Ollama)

**File:** `desktop/src/lib/providers.ts` `selectProvider`  
**Line:** `await identityManager.saveActiveProfile(...)` inside the same `try` as health check.

If health succeeded but **profile save threw**, the outer `catch` treated activation as failed (false negative).

**R3A fix:** Profile save errors are logged and **do not** fail activation.

### Tertiary bug (race / wrong provider)

**File:** `desktop/src/lib/settings.ts` `bootstrap()` (before R3A)  
Called `selectProvider(loaded.providers.preferredProviderId)` **in parallel** with `providerManager.bootstrap()` and **before** identity finished loading.

If `preferredProviderId` was a **cloud** provider (`openai`, etc.), PRISM hit **backend-only** health and failed even with Ollama up.

---

## 2. Exact failing request (when Ollama is up but PRISM fails)

| Request | When |
| --- | --- |
| `GET http://127.0.0.1:8000/api/v1/provider/health` | Ollama direct probe skipped or failed; or selected provider is not `ollama` |
| **Not** `GET http://127.0.0.1:11434/api/tags` | Bug: PRISM never called Ollama in the original path |

**URL printed in dev:** Open DevTools → filter `[PRISM Provider]` → `backend.health.request` / `ollama.probe.response`.

---

## 3. Endpoint used

| Layer | Endpoint |
| --- | --- |
| Desktop (Ollama) | `GET {ollamaBase}/api/tags` |
| Desktop (backend) | `GET /api/v1/provider/health` |
| Backend health | LiteLLM `acompletion` test to `litellm_default_model` (e.g. `ollama/llama3.2`) with `api_base=OLLAMA_BASE_URL` |

---

## 4. Expected vs actual response

### Ollama direct (expected when local AI is used)

- **Expected:** `200` JSON with `models` array.
- **Actual (verified):** `200`, CORS allows `Origin: http://127.0.0.1:1420`.

### Backend health (when API not running)

- **Expected (if backend up):** `{ data: { provider, healthy: true, latency_ms } }` → unwrapped to `ProviderHealth`.
- **Actual (audit):** `fetch` fails — network error / connection refused (no JSON).

### Backend health (when API up but wrong `OLLAMA_BASE_URL`)

- **Expected:** `healthy: true` if LiteLLM can reach Ollama.
- **Actual:** `healthy: false`, `message` from LiteLLM (e.g. connection to `http://ollama:11434` from host-run backend).

---

## 5. JSON parsing

`api.ts` `unwrapData()` correctly unwraps FastAPI `DataResponse`. Failure mode is **no response** (backend down), not parse errors.

---

## 6. Activation state

On failure, `updateProvider(..., { status: 'inactive', error })` and `setActiveProvider(null)` on bootstrap failure.  
**Stale UI:** Possible if an old error toast is shown before rebuild; store updates are synchronous. No long-lived cached failure beyond `localStorage` preferred provider id.

---

## 7. Timeout

- Ollama probe: **8000 ms** per base (`AbortController`).
- `api.request`: no explicit timeout (browser default) — can hang then fail if backend is slow.

---

## 8. Tauri vs browser

Same JavaScript path and `fetch` from `http://127.0.0.1:1420`.  
**Not Tauri-specific** unless an old production bundle is running. CORS on Ollama is OK for the dev origin.

---

## Root cause (summary)

PRISM treated **backend LiteLLM health** as the sole signal for “provider activated.” With the FastAPI process stopped (or `OLLAMA_BASE_URL` wrong for a host-run backend), activation failed **without ever requiring a successful Ollama `/api/tags` check.**  
Compounding issues: duplicate `selectProvider` from settings bootstrap, unused `settings.providers.ollamaEndpoint`, and profile-save errors failing the whole activation `try` block.

---

## Minimal fix (applied)

1. **Direct Ollama probe** before/alongside backend (`GET …/api/tags`).
2. **Include** `prism_app_settings.providers.ollamaEndpoint` in probe bases.
3. **Sequence bootstraps** in `main.tsx`: identity → settings load → provider bootstrap.
4. **Remove** duplicate `selectProvider` from `settingsManager.bootstrap()`.
5. **Do not fail activation** when profile save fails after successful health.
6. **Dev-only logs:** `[PRISM Provider]` in console (`import.meta.env.DEV`).

---

## How to verify

```powershell
cd d:\Code_yees\PRISM\desktop
npm run build
npm run tauri dev
```

DevTools → Console → `[PRISM Provider]`:

- `ollama.probe.response` with `url: http://…/api/tags`, `status: 200`
- `checkProviderHealth.ok` with `via: ollama-direct`
- Success toast: **Local AI Connected**

If you still see failure, check `bootstrap` log for `targetId` — if it is `openai`/`anthropic`, start backend or switch preferred provider to **ollama** in Settings.

---

## Files changed (R3A)

- `desktop/src/lib/providers.ts` — debug logging, settings endpoint, bootstrap, profile-save isolation
- `desktop/src/lib/settings.ts` — bootstrap no longer activates provider; save uses `softFail`
- `desktop/src/main.tsx` — ordered async bootstrap chain
