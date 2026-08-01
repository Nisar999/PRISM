# Design Reference Assets

This folder holds **design-time reference material only** — Figma exports, brand
explorations, reference UIs, motion studies, and anything designers hand to
engineering. Nothing in `assets/reference/` is bundled into the application.

## Runtime vs reference

| Location | Purpose | Shipped? |
|----------|---------|----------|
| `assets/reference/**` | Design references, explorations, hand-off material | **No** |
| `assets/branding/`, `assets/logo/`, `assets/icons/`, `assets/splash/`, `assets/wallpapers/`, `assets/milly/` | Canonical approved brand masters (source of truth) | No (masters) |
| `desktop/src/assets/**` | Runtime assets imported by the app (Vite-bundled) | **Yes** |
| `desktop/public/**` | Runtime assets served as-is (favicon, host pages) | **Yes** |

To promote a reference asset to runtime: copy the approved export into
`desktop/src/assets/<area>/` (imported by components) or `desktop/public/`
(served verbatim), optimize it (SVG preferred; PNG at 1x/2x), and reference it
through `desktop/src/lib/brand.ts` when it is a brand asset.

## Folder layout

```
assets/reference/
├── milly/        Milly logos, mascot variants, expression sheets
├── branding/     Wordmarks, lockups, color/typography explorations
├── ui/           Reference UI screens, Figma frame exports (PNG/SVG)
├── icons/        Icon sets and glyph explorations
└── animations/   Motion studies, Lottie/GIF/MP4 references
```

## Conventions

- **Naming**: `kebab-case` with a scope prefix and, when exported from Figma,
  the node id: `opening-page-479-66.png`, `milly-wave-idle.gif`,
  `titlebar-434-2.svg`.
- **Figma provenance**: when exporting from Figma, keep the file key + node id
  either in the filename or in a sibling `SOURCES.md` so implementations can be
  traced back to the design (`gWywhA1FoZfyEDSkhHI9Zx` is the v1 shell file).
- **Formats**: prefer SVG for vector, PNG for raster mocks, GIF/MP4/Lottie JSON
  for motion. Keep files under ~5 MB; large videos belong in shared drive, not git.
- **No runtime imports**: application code must never import from
  `assets/reference/`. CI-visible rule of thumb: if a component needs it, it
  gets promoted (see above) — never referenced in place.

Canonical brand governance lives in [`docs/BRAND_ASSETS.md`](../../docs/BRAND_ASSETS.md)
and [`docs/PRODUCT_IDENTITY.md`](../../docs/PRODUCT_IDENTITY.md).
