# PRISM Product Identity

**Status:** Sprint 5 — Product Identity  
**Authority:** Visual identity for PRISM Desktop (does not change architecture)  
**Related:** [11_PRODUCT_CONSTITUTION.md](11_PRODUCT_CONSTITUTION.md)

---

## 1. Brand assets (canonical)

| Asset | Path | Use |
|-------|------|-----|
| **PRISM Logo** | `assets/branding/PRISM_logo.png` · `desktop/src/assets/branding/` | App icon, window icon, sidebar, toolbar, splash, About, Settings |
| **PRISM Element** | `assets/branding/PRISM_element.png` | Decorative accent — splash, empty states, Dashboard/About background |
| **Milly Mascot** | `assets/branding/Milly_Mascot.png` (source also as `assets/branding/Milly_Mascout.png`) | Companion moments only — empty Memory/Workspace, thinking/success presence, success toasts, About |

Root copies of the PNGs remain for reference; **canonical folder is `assets/branding/`**.

---

## 2. Logo rules

- Never stretch or distort — use `object-contain` and natural aspect ratio.
- Prefer height-constrained sizing (`h-7`, `h-14`, `h-24`) with `w-auto`.
- Logo is the primary brand signal on first viewport surfaces (splash, sidebar, dashboard hero).
- Do not replace the logo with generic icons in chrome.

---

## 3. Element rules

- Decorative only; keep opacity low in backgrounds (`~0.06–0.08`).
- Never compete with primary content.
- Suitable for empty states and loading accents at higher opacity.

---

## 4. Milly rules

- Milly is a **companion**, not a floating chatbot and not permanent chrome.
- Show the mascot for: welcome / first-run empty workspace, empty memory, thinking/success presence, success notifications, About.
- Toolbar presence stays a compact state orb; mascot appears only for thinking / reflecting / success moments.
- Do not pin a large Milly permanently on every screen.

---

## 5. Color usage

Desktop continues the existing CSS variables in `desktop/src/index.css` (dark, minimal, high-contrast text). Identity sprint does **not** invent a new palette — branding is carried by assets + typography + intentional empty/loading copy.

---

## 6. Loading philosophy

Replace generic spinners with intentional copy via `LoadingState`:

| Kind | Copy |
|------|------|
| workspace | Loading workspace… |
| memory | Searching memory… |
| intelligence | Connecting intelligence… |
| editor | Launching workspace… |
| milly | Milly is understanding your project… |

Use PRISM Element as a subtle animated accent — not a loud spinner.

---

## 7. Empty-state philosophy

Every major surface should offer:

1. Illustration (logo / element / milly as appropriate)
2. Helpful description
3. Suggested next action (route or command)

Component: `desktop/src/components/brand/EmptyState.tsx`

---

## 8. Splash

`SplashScreen` shows logo + **One Mind. Infinite Shapes.** + progress + version, then fades into the shell (once per session via `sessionStorage`).

---

## 9. About

Route `/about` — product, version, architecture, build mode, optional `VITE_GIT_COMMIT`, constitution version, roadmap, docs links, copyright.

---

## 10. Application metadata

| Surface | Value |
|---------|-------|
| Window title | PRISM Desktop |
| Package | `prism-desktop` `0.9.0` |
| Tauri productName | PRISM |
| Identifier | `app.prism.desktop` |
| Favicon | `/favicon.png` (from logo) |

---

## 11. Hygiene

- Prefer `assets/branding/` over scattering PNGs.
- Correct spelling in code: `Milly_Mascot.png` (legacy source filename `Milly_Mascout.png` retained under `assets/branding/`).
- Remove Vite template `vite.svg` favicon usage.
