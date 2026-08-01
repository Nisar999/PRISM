# PRISM Design System

This document describes how the abstract rules defined in [UI Design Language](UI_DESIGN_LANGUAGE.md) and [Motion Language](MOTION_LANGUAGE.md) are technically implemented in the PRISM Desktop client (v0.9.0 Alpha).

## Architecture

The design system is implemented using:
- **TailwindCSS**: For utility classes and design tokens.
- **shadcn/ui**: For accessible component primitives.
- **Lucide React**: For iconography.

## Design Tokens (Tailwind Configuration)

### Color System
Colors are defined using HSL variables in `index.css` to support dark mode by default.

- **Backgrounds**: `bg-background` (App), `bg-surface` (Panels), `bg-elevated` (Modals)
- **Accents**: `bg-primary`, `text-primary` (Actionable items)
- **States**: `bg-success`, `bg-warning`, `bg-destructive`

### Typography
- **Font**: Inter (sans-serif) is the default font.
- **Monospace**: JetBrains Mono for code blocks and technical data.
- **Weights**: 400 (regular), 500 (medium), 600 (semibold).

## Component Primitives

PRISM uses composable primitives built on Radix UI (via shadcn/ui).

### 1. Panels
All major UI sections are wrapped in Panel components with consistent padding and borders.
- Uses `bg-surface` and `border-border`.

### 2. Typography
Headers and body text map strictly to the Tailwind prose classes to ensure consistent line height and tracking.

### 3. Interactive Elements
- **Buttons**: Variant-based (default, outline, ghost).
- **Inputs**: Consistent focus rings (`ring-2 ring-primary/20`).

## Layout Primitives

The layout is strictly managed by the `AppShell` component.

1. **Sidebar**: Fixed width, collapsible, houses global navigation.
2. **Top Toolbar**: Contextual actions and breadcrumbs.
3. **Status Bar**: System status, Kernel connection state, Milly presence.
4. **Main Content**: Scrollable region for active views.

## Motion Implementation

Animations are implemented via CSS transitions for simple states and Framer Motion for complex orchestrations (like the Milly Renderer).

- **Hover States**: `transition-colors duration-200 ease-in-out`
- **Panel Entrances**: Standardized to `duration-300` with `ease-out` curves.
