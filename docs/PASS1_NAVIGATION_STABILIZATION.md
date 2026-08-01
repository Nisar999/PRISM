# Pass 1 — Navigation & Workflow Stabilization

**Date:** 2026-07-29  
**Architecture impact:** ZERO  
**Scope:** Fix incorrect behavior only — no redesign, no new managers/stores/workflows.

---

## Root causes

| Issue | Root cause |
|-------|------------|
| Splash auto-advances | `SplashScreen` `useEffect` timer (`minDurationMs` default 4200) called `finishWelcome` without CTA |
| Agent / Conversation before Login | `App` mounted `AppShell` **under** the splash overlay → chrome painted / flickered before gate completed |
| Dead menus | Only **File** had a dropdown; Edit/Selection/View/Go/Run/Help opened the palette; **Terminal** missing from menu bar |
| Open Workspace fails | Conversation “worktree” navigated to `/workspace` which re-ran a relative `projects/prism-demo` path (no native picker); Windows path join mixed separators |
| Provider selector dead | Composer model chip only routed to Settings; login chip was display-only |
| SHAPES static | `HeroPanel` used a fixed Instrument Serif span — font-cycle never restored |
| Login clip / spacing | BrandLockup `top-[-18px]` + oversized glass panel overflowed the 1440×1024 artboard |

---

## Files changed

| File | Change |
|------|--------|
| `desktop/src/components/brand/SplashScreen.tsx` | Removed auto-timer; CTA / Continue only |
| `desktop/src/App.tsx` | Mount router/shell **only after** splash gate dismisses |
| `desktop/src/components/dashboard/ShapesAccent.tsx` | **New (presentation)** — SHAPES typography cycle |
| `desktop/src/components/dashboard/HeroPanel.tsx` | Uses `ShapesAccent` for SHAPES |
| `desktop/src/components/brand/AuthScreen.tsx` | Spacing / placement; wired provider select |
| `desktop/src/components/auth/GlassLoginPanel.tsx` | Fit panel; provider dropdown |
| `desktop/src/components/ui/ProviderIndicator.tsx` | Optional interactive toggle |
| `desktop/src/components/layout/TitleBar.tsx` | Full menus incl. Terminal; real command items |
| `desktop/src/pages/ConversationPage.tsx` | Open Workspace via `workspace:open`; provider switch + persist |
| `desktop/src/components/workspace/ChatHub.tsx` | Pass provider props to composer |
| `desktop/src/components/ui/CommandComposer.tsx` | Provider list dropdown |
| `desktop/src/pages/WorkspacePage.tsx` | Open Workspace → native `workspace:open` |
| `desktop/src/lib/workflows/openWorkspace.ts` | Default `openEditor: false` (Conversation stays primary) |
| `desktop/src/lib/workspace.ts` | Safer Windows path join for `project.json` |

---

## Screenshots

| Step | File |
|------|------|
| Splash (waits; no auto-advance) | `docs/pass1-screenshots/01-splash.png` |
| Login (no Agent chrome) | `docs/pass1-screenshots/02-login.png` |
| Conversation hub | `docs/pass1-screenshots/03-conversation.png` |

---

## Validation checklist

| # | Check | Result |
|---|--------|--------|
| 1 | Splash waits >5s without advancing | **PASS** (browser) |
| 2 | Advances only on “let's Start Innovating !” | **PASS** |
| 3 | Login shows; Agent chrome not visible | **PASS** (`agentVisible: 0`) |
| 4 | Continue → Conversation hub | **PASS** |
| 5 | File → Open Folder… menu item present | **PASS** |
| 6 | View / Edit / Terminal / Milly menus open with items | **PASS** |
| 7 | Launch PRISM IDE button present | **PASS** |
| 8 | Frontend `npm run build` | **PASS** |
| 9 | Open Workspace (native dialog) | Requires **Tauri** desktop (dialog plugin); wired to `workspace:open` (Conversation, Workspace page, File menu, Agent Chat empty state) |
| 10 | Provider dropdown switch + settings persist | Wired via `providerManager.selectProvider` + `settingsManager.updateOption` |
| 11 | SHAPES font cycle on login hero | Restored (`ShapesAccent`) |

### Manual (desktop.exe)

- [ ] File → Open Folder → native picker → project binds → Explorer updates  
- [ ] Composer provider list → switch → UI updates → survives reload  
- [ ] Launch PRISM IDE → `/editor`  
- [ ] SHAPES visibly cycles fonts on Login  

---

## Flow (enforced)

```
Launch → Splash (indefinite) → Login → Conversation → IDE (Launch / Go → Editor)
```

Single gate: splash/login block the shell until Continue. No intermediate AppShell under the gate.
