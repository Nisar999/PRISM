# PRISM Brand Assets & Visual Identity Specification

This document defines the permanent branding and visual asset system for PRISM. It serves as the specification for creating and organizing static and dynamic assets across all PRISM interfaces (Desktop, Web, CLI). For the core layout, spacing, and styling rules, see [UI Design Language](UI_DESIGN_LANGUAGE.md).

---

## 1. Asset Directory Structure

To ensure a clean, reusable system, all branding assets are organized in the root `assets/` directory. Each folder contains a `.keep` file to preserve structure, allowing future generated assets to be dropped in without restructuring the repository.

```text
assets/
├── branding/     # Brand identity guides, color swatch files, press kit components
├── logo/         # Vector (SVG) and raster (PNG) brand logos (wordmarks, glyphs)
├── icons/        # Custom SVG icons, desktop app icons, window controls, and favicon builds
├── milly/        # Visual state animations and configuration assets for Milly
├── splash/       # Launch and loading screen animation sequences or image files
├── wallpapers/   # High-resolution visual backgrounds for main workspaces or developer setups
└── reference/    # Design-time hand-off only (Figma exports, explorations) — NEVER runtime-imported
```

Runtime assets live under `desktop/src/assets/` (Vite-bundled) and `desktop/public/`
(served as-is). See [`assets/reference/README.md`](../assets/reference/README.md) for
how to organize and promote design references.
---

## 2. Logo System

The PRISM logo system is designed around the concept of dispersion and alignment. It consists of three components:

1. **The Prism Glyph**: A stylized, minimalist equilateral triangle with sharp points. The center of the triangle has a vertical refraction line separating it into a solid fill on the left and a dense micro-striped pattern on the right, representing raw data entering and dispersing into organized intent.
2. **The PRISM Wordmark**: Standardized in uppercase using custom geometric lettering derived from the primary font family. The letters are tracked wide (`letter-spacing: 0.15em`).
3. **The Lockup**: The combined glyph (left) and wordmark (right) with a strict `1:3` aspect ratio ratio.

### Logo Rules:
- **Scalability**: The logo glyph must remain legible at sizes as small as `16x16 px`.
- **Monochrome Default**: The logo is natively white (`#FFFFFF`) on dark surfaces and black (`#0A0A0A`) on light surfaces. No gradient fills are permitted in the base logo.

---

## 3. App & Window Icon Specifications

### Desktop App Icon
The primary app icon (`assets/icons/app-icon`) represents the application package in the host OS dock or taskbar.
- **Form Factor**: Circular container with a dark-slate base (`#0C0C0E`), hosting the Prism Glyph in the center with a subtle glowing edge.
- **Sizes Required**:
  - `macOS`: ICNS format containing `16x16`, `32x32`, `64x64`, `128x128`, `256x256`, `512x512`, `1024x1024` sizes (supporting Retina).
  - `Windows`: ICO format containing `16x16`, `24x24`, `32x32`, `48x48`, `256x256` sizes.
  - `Linux`: SVG vector format, scaling dynamically.

### Window Icon
Used in the native system window frame and title bar.
- **Format**: SVG or `32x32 px` transparent PNG.
- **Visual**: The standalone Prism Glyph, colored according to the system status (e.g., green when kernel is online, amber when updating, red on error).

---

## 4. Splash Screen Guidelines

The desktop application uses a native splash screen during kernel initialization.
- **Dimensions**: `600x400 px`, borderless window.
- **Background**: Solid deep black (`#060608`).
- **Animation**: The Prism Glyph fades in slowly (`ease-in-out`, `800ms`), followed by a thin, colored refraction line scanning horizontally across the bottom indicating loading progress.
- **Context Details**: Text showing the boot log (e.g., `Booting Memory Engine...`, `Checking Skill Registry...`) renders in a tiny monospace font (`10px`, opacity `0.4`) at the bottom-left corner.

---

## 5. Color Token Exports

Color tokens are exported as raw CSS custom properties to be consumed by the UI.

```css
:root {
  /* Core Brand Grays */
  --prism-black: #060608;
  --prism-slate-900: #0a0a0c;
  --prism-slate-800: #121216;
  --prism-slate-700: #1c1c24;
  --prism-gray-400: #a1a1aa;
  --prism-white: #f4f4f5;

  /* Refraction Accents */
  --prism-emerald: #10b981;  /* Active / Runtime */
  --prism-amber: #f59e0b;    /* Planning / Pending */
  --prism-rose: #e11d48;     /* Error / Glitch */
  --prism-violet: #8b5cf6;   /* Cognitive Routing */
  --prism-cyan: #06b6d4;     /* Memory Engine */
}
```

---

## 6. Typography Assets

Fonts must be loaded locally to prevent external network request latency.
- **Inter (Regular, Medium, Semi-Bold)**: Loaded as `.woff2` files inside `assets/branding/fonts/inter/`.
- **JetBrains Mono (Regular, Medium)**: Loaded as `.woff2` files inside `assets/branding/fonts/jetbrains-mono/`.

---

## 7. Illustration & Icon Style

### Illustration Guidelines
PRISM avoids decorative, detailed illustrations. If a visualization requires illustrative concepts:
- **Wireframe Aesthetics**: Use clean vector line art. Lines should be `1px` thick with 100% sharp vertices (no smooth curves unless representing wave functions).
- **Abstract Data Plots**: Prefer node-graphs, sequence charts, and schematic visual blueprints over cartoonish avatars or abstract isometric scenes.

### Icon Style
- **Line Width**: Strict `1.5px` or `2.0px` stroke.
- **Corner Radius**: `0px` (sharp/square corners only) to emphasize precise engineering.
- **Coloring**: Icons inherit the current text color (`currentColor`), occasionally taking semantic highlights for active indicators.

---

## 8. Milly Asset Specification

Milly is the ambient, visual indicator of PRISM's internal state machine. She is stored as dynamic SVG assets or canvas rendering configurations under `assets/milly/`.

### State Definitions

| State | Visual Intent | Animation Intent | Trigger Condition | Future Implementation Notes |
|-------|---------------|------------------|-------------------|-----------------------------|
| **Idle** | A calm, stable visual pulse. Muted cool gray. | Smooth breathing scale (`1.0` to `1.03`), `3000ms` cycle. | PRISM Core is boot-completed, idling, and awaiting a new user intent. | Can be rendered as a light SVG shadow filter or pure CSS animation. |
| **Thinking** | Rapid, dynamic morphing of the shape boundaries. Muted violet. | Fluid organic wave motion, undulating vertices, `1500ms` cycle. | Intent Engine is parsing or Model Router is actively querying provider metrics. | Render via HTML5 Canvas with simplex noise for fluid morphing. |
| **Planning** | A splitting or subdividing grid of lines. Amber. | Central dot splits into a structured tree-grid, sliding outwards. | Cognitive Planner is generating ExecutionPlan stages and tasks. | SVG path animation with `stroke-dasharray` offsets. |
| **Memory** | Concentric rings expanding or contracting. Cyan. | Circular radar sweep radiating from center, `2000ms` cycle. | Memory Engine is performing vector similarity search or self-healing. | SVG circles with variable opacity and scale transitions. |
| **Runtime** | A high-energy, spinning geometric orb. Emerald. | Sharp outer ring spinning rapidly around a glowing core. | Execution Runtime is executing task steps via tool executors. | Fast WebGL or CSS 3D transform rotation on Z-axis. |
| **Success** | A sudden, bright outward burst followed by settling. Emerald. | Rapid scale outward to `1.8`, fading to `1.0` with a soft particle release. | A tool execution session finishes in `SUCCEEDED` state. | Brief particle emitter effect on canvas. |
| **Error** | A jagged, fractured shape with visible color splits. Rose/Red. | Rapid vertical glitch jitter, high frequency color aberration. | Execution session enters `FAILED` state or Kernel encounters an unhandled exception. | CSS shake animations combined with SVG turbulence filters. |
| **Sleeping** | A slow, low-intensity pulse that periodically dims. Muted slate. | Long breathing cycle (`6000ms`), fading down to `15%` opacity. | System enters low-power standby or CLI workspace adapter goes inactive. | Transition duration increased to prevent visual distraction during focus times. |

---

## 9. Reusable Asset Integration Guidelines

1. **Import Path**: React applications should import assets using path aliases pointing to the asset workspace:
   `import logoGlyph from '@/assets/logo/prism-glyph.svg';`
2. **Dynamic States**: When displaying Milly, UI developers should pass the state variable to a state-driven wrapper:
   `<MillyState state={currentSessionState} />`
   The component maps states to the corresponding animation config specified in Section 8.
