# PRISM UI Design Language

## 1. Brand Philosophy

**One Mind. Infinite Shapes.**

PRISM is not a single application; it is a unified, persistent intelligence designed to interface with the world through multiple shapes. 

- **PRISM Owns Intelligence**: The backend core handles all reasoning, memory, execution, and state management.
- **Desktop Owns Experience**: The desktop application (and any future web, mobile, or CLI shell) is strictly a visualizer and controller. Interfaces contain zero business logic. They exist solely to manifest the internal cognitive processes of PRISM into a human-readable format.

## 2. Design Principles

- **Transparency over Abstraction**: Never hide what the system is thinking or doing. Show the cognitive pipeline, display confidence scores, and expose the 'why' behind actions.
- **Focus and Restraint**: The interface should be uncluttered. Use progressive disclosure to reveal complexity only when requested.
- **Utilitarian Elegance**: PRISM is a developer-centric tool. It must feel like an advanced operating system—precise, highly technical, yet beautiful and responsive.
- **Trust through Visibility**: PRISM builds trust by showing its work. Memory retrieval, reflections, and tool orchestration must always be easily auditable.

## 3. Visual Identity

PRISM's visual identity leans into the aesthetic of high-end data visualization and futuristic interfaces while maintaining strict utilitarian functionality. It avoids overly playful or consumer-centric metaphors. 

- **Geometry**: Sharp edges with slight rounding for comfort (e.g., `0.5rem` border radius).
- **Depth**: True black backgrounds with elevated surfaces differentiated by subtle lighting and distinct border colors, rather than heavy drop shadows.
- **Glassmorphism (Restrained)**: Use semi-transparent backdrops with blur exclusively for floating elements (modals, command palettes, and the Top Toolbar).

## 4. Color System

The PRISM UI is **Dark-First**. It thrives on high contrast against deep slate backgrounds.

### Semantic Colors
- **Background**: `240 10% 3.9%` (Deep Slate / True Black)
- **Foreground**: `0 0% 98%` (Crisp White)
- **Card/Surface**: `240 10% 3.9%` (Slightly elevated slate)
- **Primary**: `210 40% 98%` (Ice White) - Used for primary actions and active states.
- **Secondary**: `240 3.7% 15.9%` - Used for secondary surfaces, hovering, and subtle backgrounds.
- **Border**: `240 3.7% 15.9%` - Used universally to separate panes and surfaces.

### Status Colors
- **Success/Active**: Emerald / Green (`#10b981`)
- **Warning/Pending**: Amber / Yellow (`#f59e0b`)
- **Error/Destructive**: Rose / Red (`#e11d48`)
- **Info/Processing**: Blue (`#3b82f6`)

### Light Theme Strategy
While dark mode is native, the light mode strategy simply inverts the depth. Backgrounds become crisp white (`#ffffff`), and text becomes deep slate (`#0f172a`), maintaining the exact semantic color hierarchy.

## 5. Typography

Typography must communicate precision and technical capability.

- **Primary Font**: `Inter` (or system UI standard like San Francisco/Segoe UI) for highly readable, dense information displays.
- **Monospace Font**: `JetBrains Mono` or `Fira Code` for all logs, code snippets, tool outputs, and metadata IDs.
- **Hierarchy**:
  - `h1`: 24px, Tracking Tight, Semi-bold (Panel Headers)
  - `h2`: 16px, Tracking Normal, Medium (Section Headers)
  - `body`: 14px, High legibility, Normal (Main content)
  - `metadata`: 12px or 11px, Muted (Status bars, timestamps, system IDs)

## 6. Spacing System

Spacing is based on a strict `4px` grid (Tailwind defaults).

- **Micro (2px - 4px)**: Internal icon spacing, badge padding.
- **Tight (8px)**: Component clustering (e.g., label to input).
- **Base (16px)**: Standard padding for panels, cards, and main containers.
- **Relaxed (24px - 32px)**: Section separation and major architectural blocks.

## 7. Grid System

- The primary interface utilizes a **flexbox/grid hybrid** structure.
- Main workspaces utilize CSS Grid for multi-pane layouts (e.g., 2-column or 3-column data views).
- The dashboard is built on a responsive 12-column grid system that collapses gracefully on smaller screens.

## 8. Iconography

- **Library**: `lucide-react` (Lucide).
- **Style**: Line icons, `1.5px` to `2px` stroke width.
- **Usage**: Icons should always be accompanied by labels unless they are universal actions (e.g., close, minimize). Never use icons purely for decoration.

## 9. Window Layout

The PRISM Desktop application uses the approved IDE shell (Figma `434:2`). Canon: [DESKTOP_SHELL.md](DESKTOP_SHELL.md).

1. **TitleBar** (40px): Menu labels (File, Edit, Selection, View, Go, Run, Help).
2. **ActivityBar** (52px): Explorer / Search / Agent / Editor / Terminal / Settings.
3. **Sidebar** (resizable): Workspace explorer.
4. **Editor area**: Welcome shortcuts or route surfaces; `/editor` hosts Code-OSS.
5. **Agent panel** (resizable): Chat / Thoughts / Memory / Context (`IntelligenceRail`). Thoughts replaces the former Thought View and stays inside the panel.
6. **Terminal dock** (resizable): Execution output / graph / code review (`ExecutionDock`).
7. **StatusBar** (24px): Live kernel / project / memory metrics.

VS Code owns in-editor terminal UX when embedded; the PRISM bottom dock is execution/output chrome, not a rebuilt system terminal.

## 10. Navigation Rules

- **Active State**: The active tab in the sidebar must have a distinct background (`Secondary`) and high-contrast text.
- **Deep Linking**: All views must be individually routeable (e.g., `/planning/execution-session-123`).
- **Context Preservation**: Navigating away from a workspace and returning should preserve local UI state (scroll position, open accordions) where possible.

## 11. Component Philosophy

- **shadcn/ui Baseline**: Components are built using unstyled primitives (Radix) styled with TailwindCSS.
- **No Duplication**: Logic belongs in custom hooks or the API client. Components should be strictly presentational.
- **Dense by Default**: Since PRISM is a developer tool, components (tables, lists, forms) should favor high information density over excessive padding.

## 12. Motion Language

Animation in PRISM is functional, never decorative. It draws attention to state changes or system activity.

- **State Transitions**: Quick fades (`fade-in`, `duration-300`).
- **Activity**: Subtle pulsing (`animate-pulse`) for active tasks or active cognitive stages.
- **Lists/Data**: Enter animations should stagger slightly to establish hierarchy.

## 13. Animation Timing

- **Micro-interactions** (Hover, Focus): `150ms`, `ease-out`.
- **View Transitions** (Page loads): `300ms`, `ease-in-out`.
- **System Pulses** (Active states): `2000ms`, continuous.

## 14. Loading States

- Avoid full-page spinners. 
- Use **Skeleton Loaders** matching the final data shape for primary workspaces.
- Use localized inline spinners (e.g., an animated icon) for atomic actions (e.g., saving a setting, refreshing a single pane).

## 15. Empty States

Empty states should guide the user.

- Provide a clear, subdued icon.
- Briefly explain *why* it is empty.
- Provide a primary call to action or command to populate the view.

## 16. Error States

- **Inline Errors**: Highlight the specific component with a destructive border/text. Provide a tooltip or small label with the exact error.
- **System Errors**: Full-pane error boundaries must cleanly catch crashes. They should display the raw stack trace in a monospace block, alongside a button to restart or reset the view.

## 17. Dashboard Rules

- The Dashboard is the central pulse of the system.
- It must provide a real-time, birds-eye view of the Cognitive Pipeline.
- Never use the dashboard for direct configuration—it is purely for observability and jumping into deeper sections.

## 18. Accessibility

- **Contrast**: Text must pass WCAG AA standards. Muted text must still be highly legible against the dark background.
- **Focus States**: All interactive elements must have a highly visible focus ring (`ring-primary/50`).
- **Keyboard Navigation**: The entire shell must be navigable without a mouse, particularly the sidebar and primary data tables.

## 19. Responsive Strategy

- PRISM Desktop is designed primarily for desktop window sizes (`min-width: 800px`).
- Below `800px`, multi-pane views should collapse into single columns.
- The sidebar may collapse into an icon-only view if space is constrained.

## 20. Future Expansion Rules

Any new visualizer (e.g., Globe View, Thought View) must:
1. Reside strictly within the Main Workspace.
2. Re-use existing `Card` and `Panel` component tokens.
3. Fetch data exclusively through `PrismApiClient`.
4. Never introduce new primary colors or fonts.

---

## 21. Milly: Visual System State

### Purpose
Milly is the anthropomorphized, visual representation of PRISM's current cognitive state. 
**Milly is NOT a chatbot.** She does not have a chat interface, and she does not "speak" to the user. Instead, she provides an immediate, ambient visual cue of what the PRISM Kernel is actively doing.

### Cognitive State Representation
Milly is represented by an abstract, ambient visual element (e.g., an animated geometric orb, a localized waveform, or a minimalistic avatar). She usually resides in the top toolbar or the bottom status bar, acting as the system's "heartbeat."

- **Idle Behavior**: 
  - *Visual*: Soft, slow pulsing. Low opacity. Cool colors (muted blue or gray). 
  - *Meaning*: PRISM is waiting for an Intent or running background maintenance.
- **Thinking Behavior**: 
  - *Visual*: Rapid morphing or spinning. Medium opacity. 
  - *Meaning*: PRISM is actively routing models, traversing the Knowledge Graph, or processing the Context Engine.
- **Planning Behavior**: 
  - *Visual*: Geometric structuring (e.g., splitting into multiple nodes or connecting lines).
  - *Meaning*: The Cognitive Planner or Tool Orchestrator is building Execution Plans.
- **Memory Behavior**: 
  - *Visual*: A scanning or searching motion (e.g., a sweeping gradient). 
  - *Meaning*: Querying the Memory Engine, extracting vectors, or executing a retrieval loop.
- **Runtime Behavior**: 
  - *Visual*: High energy, solid opacity. Primary branding color (Ice White or Emerald Green). 
  - *Meaning*: Active Tool execution via the Execution Runtime.
- **Error Behavior**: 
  - *Visual*: Erratic glitching or a sharp, static shape. Color shifts to Destructive (Rose/Red).
  - *Meaning*: A critical failure in the cognitive pipeline, an executor crash, or a disconnected provider.
- **Notification Behavior**: 
  - *Visual*: A gentle "pop" or expansion animation, accompanied by a subtle badge.
  - *Meaning*: A task completed successfully, or an Execution Session requires user validation.

---

## 22. Anti-Principles

To preserve the utility, precision, and architectural philosophy of PRISM, all current and future user interfaces must strictly avoid the following design behaviors:

- **No Chatbot Defaults**: PRISM is a persistent cognitive core, not a chat wrapper. Do not present a standard conversation history thread as the primary interface. Dialog is only for explicit human-in-the-loop validation or input requests.
- **No Artificial Latency**: Never slow down animations or delay state updates to simulate "thoughtfulness" or make the AI feel more "human." UI responses must occur instantly upon state change in the core.
- **No Obfuscated Failures**: Avoid polite, generic error messages like *"Something went wrong."* PRISM is an engineering platform; show the full stack trace, target files, and exact exception details in a technical monospace box.
- **No Unactionable Dashboards**: Never display metrics, node graphs, or logs that cannot be clicked, filtered, or used to navigate directly to the root resource.
- **No Inconsistent Color Mapping**: Semantic colors must have one meaning. Do not use Green for anything other than success, completion, or online status. Do not use Red for anything other than active errors or failures.
- **No Blocked Main Thread Animations**: Loading and state transitions must never block user interaction with other panes. All panels, scrollable lists, and configuration views must remain fully interactive during task execution.

