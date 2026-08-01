# PRISM v1 Release Audit

Last updated: 2026-07-28

**Architecture impact:** ZERO — dead-code / unused-asset cleanup only. No feature additions. Backend, Docker, VS Code integration, Milly, Memory, and Agent left intact.

---

## Scope

| In scope | Out of scope (preserved) |
| --- | --- |
| `desktop/src` reachability | `backend/` |
| Unused desktop assets | `docker/`, compose |
| Abandoned root experiments | `vscode-main/`, scripts that boot Code-OSS |
| Dead CSS utilities | Milly / Memory / Agent managers & stores |
| | Infrastructure (`.tools/`, recovery scripts) |

---

## Dependency graph (desktop)

Entrypoints: `main.tsx` → bootstrap managers → `App.tsx` → routes under `AppShell`.

Method: static import graph with `@/` → `src/` alias resolution, then BFS reachability from `main.tsx`.

| Metric | Value |
| --- | ---: |
| Source files (ts/tsx) before cleanup | 82 |
| Import edges | ~261 |
| Unreachable components (proven) | 7 |
| Unreachable after cleanup | 0 (deleted) |

### Kept (reachable) surface — high level

```
main.tsx
 ├─ lib/{store,identity,providers,settings,plugins,memory,layout,milly,defaultCommands}
 └─ App.tsx
      ├─ SplashScreen → OpeningPage → DesignCanvas / GlowPillButton / ChromaticWordmark
      └─ AppShell
           ├─ / → Dashboard → LandingHome → BrandLockup, HeroPanel, …
           ├─ /conversation → ConversationPage → ChatHub → CommandComposer, …
           ├─ /workspace → WorkspacePage → WorkspaceExplorer
           ├─ /editor → EditorPage → EditorHost (@/editor)
           ├─ /settings → Settings
           ├─ contextual → ContextualPanelRoute (memory/thoughts/planning/execution/review)
           └─ archived redirects → ArchivedRoute
```

Milly, Memory, Agent, providers, workflows, VS Code adapter: all remain on the reachable graph.

---

## Deleted files

### Unreachable UI (no importers)

- `desktop/src/components/ui/GlassCard.tsx`
- `desktop/src/components/ui/GlassInput.tsx`
- `desktop/src/components/ui/NavRowButton.tsx`
- `desktop/src/components/ui/QuickActionButton.tsx`
- `desktop/src/components/ui/ResizeHandle.tsx`
- `desktop/src/components/ui/UpgradeCard.tsx`
- `desktop/src/components/ui/tokens.ts` (CSS/`index.css` is the token source of truth)

### Unused Figma assets (zero imports)

Landing (auth-era leftovers): `github.svg`, `google.png`, `icon-chevron.svg`, `icon-mail.svg`, `line-divider.svg`, `line-or-l.svg`, `line-or-r.svg`, `line-tab.svg`

Opening: `prism-hero-alt.png`

Workspace: `icon-arrow.svg`, `icon-arrow-2.svg`, `icon-chat.svg`, `icon-chevron-down-sm.svg`, `icon-chevron-right.svg`, `icon-clock.svg`, `icon-layout.svg`, `icon-mic.svg`, `icon-pencil.svg`, `line-nav.svg`, `logo-crystal.png`

### Abandoned / duplicate root clutter

- `Desboard/` — non-canon mockups (constitution)
- `frontend/` — deprecation tombstone only
- `rustup-init.exe` — toolchain installer (~12 MB)
- Root duplicates: `Milly_Mascout.png`, `PRISM_element.png`, `PRISM_logo.png` (canonical copies remain under `assets/branding/` and `desktop/src/assets/branding/`)

---

## Merged / slimmed (no duplicate component merges required)

No parallel live implementations of the same feature were found that were safe to merge without behavior change.

Cleanup edits:

| Change | Rationale |
| --- | --- |
| Removed deprecated `Placeholder` export from `pages/Placeholder.tsx` | Replaced by `ArchivedRoute`; App already imports `ArchivedRoute` only |
| Removed dead CSS: `.prism-glass-panel`, `.prism-enter-zoom`, `.prism-loading-shimmer`, `.prism-border-hairline`, `.prism-fill-hover`, unused auth/CTA gradient tokens & `prism-shimmer` / `prism-zoom-in` keyframes | Only consumers were deleted components or nothing |

Duplicate stores/hooks: **none deleted**. Manager+store pairs (`identity`, `providers`, `agent`, `memory`, …) are intentional architecture.

---

## Not removed (intentionally)

| Item | Why kept |
| --- | --- |
| Archived routes (`/about`, `/runtime`, …) | Deep-link redirects via `ArchivedRoute` |
| `CodeReviewPage.tsx` | Exports `CodeReviewPanel` used by `ExecutionDock` |
| Design-token CSS variables + Tailwind theme map | Still referenced by live classes (`bg-prism-soft`, radii, fonts, …) |
| Backend / Docker / vscode-main / scripts | Explicit preserve list |
| Sprint docs under `docs/` | Historical audit trail; not dead product code |

---

## Build result

```text
cd desktop && npm run build
# tsc && vite build
# ✓ 1892 modules transformed
# ✓ built in ~10s
# exit 0
```

**PASS** — TypeScript + Vite production build green after cleanup.

---

## Constraints checklist

| Constraint | Honored |
| --- | --- |
| No deletion of referenced code | Yes |
| No infra / Docker / backend / VS Code / Milly / Memory / Agent removal | Yes |
| Architecture impact ZERO | Yes |
| Only proven-unused deletions | Yes |
