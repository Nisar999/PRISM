# Archive — Historical Snapshots

This directory catalogs documents that are **historical snapshots** — sprint
logs, incident postmortems, and release-gate reports produced during PRISM's
development. They are retained for provenance and link stability but are **not
part of the evergreen canon** and should not be used as onboarding material.

> **Note on location:** These files currently remain in `docs/` (not moved here)
> because the agent sandbox blocked the physical relocation. The classification
> below is authoritative. To physically relocate them, run (on a normal shell):
>
> ```bash
> mkdir -p docs/archive/sprints
> mv docs/PASS1_NAVIGATION_STABILIZATION.md \
>      docs/UX1_SHELL_COMPLETION.md \
>      docs/LAUNCH_REPORT.md docs/LAUNCH_FAILURE_REPORT.md \
>      docs/NATIVE_DESKTOP_REPORT.md \
>      docs/PROVIDER_ACTIVATION_R3A_REPORT.md \
>      docs/INFRASTRUCTURE_R3_REPORT.md \
>      docs/CODE_OSS_STARTUP_R3B.md docs/CODE_OSS_BOOTSTRAP_R3C.md \
>      docs/ENV5_GIT_RECOVERY.md \
>      docs/VSCODE_GIT_RECOVERY_DIFF_20260728-211425.md \
>      docs/EXPERIENCE_STATE_R4.md \
>      docs/V1_RC_REPORT.md \
>      docs/archive/sprints/
> ```
> Then update the single cross-reference in `docs/ux1-screenshots/README.md`.

## Historical design documents (numbered series)

Already carry deprecation banners and are kept in place:

`01_VISION.md` · `02_PRD.md` · `03_ARCHITECTURE.md` · `04_REPOSITORY_STRUCTURE.md`
· `05_LLM_PROVIDER_SPEC.md` · `06_VISUAL_COGNITION.md` · `07_AGENT_SPEC.md`
· `08_DOCKER_ARCHITECTURE.md` · `09_CODING_STANDARDS.md` · `10_ADR.md`

## Sprint / incident logs (historical)

| Document | Era | Topic |
|----------|-----|-------|
| `PASS1_NAVIGATION_STABILIZATION.md` | Pass 1 | Splash/auth/menu/workspace stabilization |
| `UX1_SHELL_COMPLETION.md` | UX-1 | Figma-to-implementation shell completion |
| `LAUNCH_REPORT.md` | Sprint 6 | End-to-end launch validation |
| `LAUNCH_FAILURE_REPORT.md` | Sprint 6A | White-screen circular-dependency fix |
| `NATIVE_DESKTOP_REPORT.md` | Tauri R2 | Native environment verification |
| `PROVIDER_ACTIVATION_R3A_REPORT.md` | R3A | Provider activation root cause |
| `INFRASTRUCTURE_R3_REPORT.md` | R3 | Code-OSS embed, providers, Tauri FS |
| `CODE_OSS_STARTUP_R3B.md` | R3B | Code-OSS native startup fix |
| `CODE_OSS_BOOTSTRAP_R3C.md` | R3C | Code-OSS `npm ci` bootstrap gate |
| `ENV5_GIT_RECOVERY.md` | ENV-5 | Attach git to zip-sourced `vscode-main` |
| `VSCODE_GIT_RECOVERY_DIFF_20260728-211425.md` | ENV-5 | Generated diff artifact |
| `EXPERIENCE_STATE_R4.md` | R4 | Derived experience-state presentation |
| `V1_RC_REPORT.md` | v1.0.0-rc.1 | Release-candidate readiness matrix |

## Partially-stale (retained, use with care)

- `V1_RELEASE_AUDIT.md` — dead-code cleanup audit; some "deleted" claims are
  stale (e.g., `GlassCard.tsx`, `GlassInput.tsx` still exist). Treat as a
  point-in-time snapshot.
- `NATIVE_DESKTOP_READINESS.md` — gap analysis; references the removed "Open
  Demo" File menu item.
- `RELEASE2_SELF_CONTAINED_INSTALLER.md` — installer layout; contains
  machine-specific paths (`D:\cargo-target\...`).
- `PRODUCT_IDENTITY.md` — Sprint 5 identity rules; largely subsumed by
  `11_PRODUCT_CONSTITUTION.md` + `BRAND_ASSETS.md`.

## Evergreen canon (NOT archived)

See [../ARCHITECTURE_INDEX.md](../ARCHITECTURE_INDEX.md) for the living
documentation tree, and [../ARCHITECTURE_FREEZE.md](../ARCHITECTURE_FREEZE.md)
for the list of frozen specs that must not be modified.
