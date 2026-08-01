# Sprint UX-1 — Product Shell Completion

**Status:** Complete  
**Architecture impact:** ZERO  
**Build:** `npm run build` PASS (`tsc && vite build`, exit 0)

Approved Figma frames (`gWywhA1FoZfyEDSkhHI9Zx`):

| Screen | Node | Implementation |
|--------|------|----------------|
| Welcome | `479:66` | `OpeningPage` via `SplashScreen` |
| Login | `428:1986` | `AuthScreen` + glass auth stack |
| Conversation | `478:284` | `ChatHub` (index `/`) |
| IDE Shell | `434:2` | `AppShell` / TitleBar / ActivityBar / `EditorWelcome` |

Flow: **Welcome → Login → Conversation hub**; IDE welcome at `/welcome`; Code-OSS at `/editor`.

---

## 1. Before / After screenshots

### After (implemented)

Captured from production preview → `docs/ux1-screenshots/`:

| File | Screen |
|------|--------|
| [after-welcome.png](./ux1-screenshots/after-welcome.png) | Opening / Welcome |
| [after-login.png](./ux1-screenshots/after-login.png) | SIGNUP / LOGIN |
| [after-conversation.png](./ux1-screenshots/after-conversation.png) | Conversation workspace |
| [after-ide-welcome.png](./ux1-screenshots/after-ide-welcome.png) | IDE shell welcome |

Re-capture: `npm run build && npm run preview` then `node desktop/scripts/ux1-screenshots.mjs`.

### Before (pre-UX-1 / v1 RC)

| Screen | Prior state |
|--------|-------------|
| Welcome | Opening splash only — then straight into shell |
| Login | **Missing** (landing assets / glass auth had been removed) |
| Conversation | Available at `/conversation`; `/` was IDE welcome |
| IDE Shell | TitleBar / ActivityBar / EditorWelcome already present |

Figma design stills could not be re-exported (MCP Starter rate limit). Compare After files to nodes `479:66`, `428:1986`, `478:284`, `434:2`.

---

## 2. Components changed

| Component | Change |
|-----------|--------|
| `SplashScreen` | Welcome → Login gate; `prism.auth.seen` |
| `AuthScreen` | Full-bleed Login gate (428:1986) |
| `App.tsx` | Index → Conversation; `/welcome` → EditorWelcome |
| `ChatHub` | Empty-state Launch IDE only + enter motion |
| `ConversationPage` | Always renders ChatHub (design empty state) |
| `vscodeWorkspaceAdapter` | Cached `getSnapshot` (fixes StatusBar infinite loop) |
| `experienceState` | Cached experience snapshot |
| `index.html` / `index.css` / `tailwind.config.js` | Auth fonts + glass tokens |

---

## 3. Components removed

| Item | Note |
|------|------|
| Interim `GlassAuth.tsx` stub | Replaced by restored glass auth stack |

---

## 4. Components reused / restored

| Component | Role |
|-----------|------|
| `OpeningPage`, `DesignCanvas`, `GlowPillButton`, `ChromaticWordmark` | Welcome |
| `AuthBackground`, `GlassLoginPanel`, `HeroPanel`, `BrandLockup` | Login |
| `GlassCard`, `GlassInput`, `LandingTabs`, `ChevronPillButton`, `SocialAuthButton`, `ProviderIndicator` | Auth card |
| `SoftGlowOrb`, `CommandComposer`, `ToolbarSelect`, `LaunchIdeButton` | Conversation |
| `TitleBar`, `ActivityBar`, `StatusBar`, `EditorWelcome`, `AppShell` | IDE shell |
| `identityManager` / `isAuthBackendAvailable` | Local continue (no OAuth) |

Landing assets restored under `desktop/src/assets/figma/landing/`.

---

## 5. Build result

```
> prism-desktop@1.0.0-rc.1 build
> tsc && vite build
✓ built in ~8s
exit_code: 0
```

---

## Notes

- Login is presentation-only; continue uses `identityManager` (local-first).
- No new managers, stores, services, or backend APIs.
- Adapter snapshot cache is a bugfix required for the shell to mount (StatusBar `useSyncExternalStore`).
