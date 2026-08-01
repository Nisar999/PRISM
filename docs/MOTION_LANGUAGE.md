# PRISM Motion Language

## Overview
This document defines the universal architectural specification for motion across all PRISM interfaces (Desktop, Web, Mobile, CLI). Following the principle of **One Mind. Infinite Shapes.**, motion in PRISM is not a visual embellishment; it is a structural mechanism for communicating the state of the PRISM Kernel.

---

## 1. Motion Philosophy

Motion in PRISM exists strictly to bridge the gap between human perception and machine execution. 

- **Communicate State**: Motion signals what the system is currently doing, what it has finished, and what requires attention.
- **Reinforce Cognition**: If the system is branching paths, motion should branch. If the system is retrieving memory, motion should sweep or pull.
- **Preserve Attention**: Motion must guide the user's eye to the exact point of required interaction without causing distraction.
- **Reduce Cognitive Load**: Smooth spatial transitions prevent the user from losing context when the layout changes.
- **Never Decorative**: Motion must *never* exist purely to look appealing. 

**Core Principle**: *Motion follows cognition. Never the opposite.* The UI does not animate to look busy; it animates because the Kernel *is* busy.

---

## 2. Motion Principles

- **Purposeful**: Every animated property (opacity, scale, position) must map to a specific data state or user intent.
- **Minimal**: Use the absolute minimum amount of movement required to communicate the transition.
- **Interruptible**: No animation can block a user action. If a user clicks during a transition, the UI must immediately snap to the final state and accept the input.
- **Deterministic**: The same state transition must yield the exact same motion every time.
- **Composable**: Complex motions (e.g., expanding a node while fading in its children) must be built from modular, atomic animation primitives.
- **Responsive**: Motion responds instantly to data. It does not introduce artificial delays to sequence an animation.
- **Data-Driven**: Velocity, duration, and scale should dynamically adapt to the underlying data (e.g., a massive log stream scrolls differently than a 3-line output).

---

## 3. Motion Categories

Motion is categorized by its systemic function:

- **State Transitions**: Morphing between distinct UI phases (e.g., Idle to Running). 
- **Navigation**: Switching between Workspaces or deep-linking into an Artifact.
- **Layout Changes**: Panes resizing, docking, splitting, or collapsing.
- **Background Activity**: Subtle, ambient indicators that the Kernel is processing without requiring focus.
- **Streaming**: The real-time rendering of incoming tokens or execution logs.
- **Execution**: Visualizing the progression of the Execution Graph (nodes lighting up).
- **Success**: Brief, positive expansion acknowledging a completed workflow.
- **Failure**: Sharp, high-contrast disruption indicating a crash or error.
- **Validation**: Urgent, pulsing motion requesting human-in-the-loop intervention.
- **Notifications**: The entrance and exit of transient system toasts.

---

## 4. Cognitive Motion

Motion directly reflects the active phase of the PRISM Kernel. The visual system (Milly) and the structural UI coordinate to communicate these states:

- **Idle**: Slow, low-frequency breathing. No structural movement.
- **Thinking**: Fluid, continuous shifting. Indicates the Intent Engine or Router is actively parsing.
- **Planning**: Outward branching or grid-based division. Communicates the generation of Execution Plans.
- **Memory Retrieval**: Sweeping, radar-like scanning or inward pulling. Represents vector or graph traversal.
- **Routing**: Rapid, discrete snapping between nodes. Represents provider evaluation.
- **Execution**: Forward, linear progression. High-energy, solid state changes as tasks complete.
- **Reflection**: Comparative, side-by-side sliding. Represents the system validating outputs against the original goal.
- **Validation**: High-contrast pulsing boundary. Signals an absolute halt pending user input.
- **Paused**: Static, frozen state with a harsh cut. Complete cessation of ambient motion.
- **Interrupted**: Immediate collapse or fade out of the current trajectory.
- **Success**: Quick, unified outward expansion that immediately settles back to Idle.
- **Failure**: Jagged, rapid jitter (glitch). Signals an unrecoverable drop in the execution path.

---

## 5. Timing Philosophy

Timing in PRISM is built on the concept of immediacy. Artificial latency is strictly forbidden.

- **Instant Feedback**: Interaction feedback (hover, focus, click) must trigger in `0ms`. The visual transition may take longer, but the state mutation is instant.
- **Transition Durations**: 
  - *Micro*: Extremely fast. Used for opacity and color shifts.
  - *Macro*: Moderate. Used for layout shifts and pane resizing to allow the eye to track spatial changes.
  - *Ambient*: Slow, continuous. Used for idle states.
- **Interruption Behavior**: If an animation is interrupted by a new state, the transition must pivot from its current mathematical value rather than snapping to start/end points.
- **Overlapping Transitions**: Multiple elements changing state should transition simultaneously. Avoid staggered, "waterfall" animations unless conveying hierarchical data loading.
- **Animation Cancellation**: Heavy network or CPU loads must automatically cancel complex UI transitions to preserve system resources.
- **Progressive Completion**: Do not wait for a full payload to animate. Streamed tokens and logs must appear immediately as they arrive.

---

## 6. Spatial Rules

Spatial motion dictates how objects move across the screen, ensuring the user never loses mental orientation.

- **Continuity**: An element moving from one pane to another must trace a direct, predictable path. 
- **Origin**: Modals, artifacts, and logs must expand outward from their trigger source (e.g., a clicked node).
- **Destination**: When collapsing or dismissing, elements must shrink back to their exact point of origin.
- **Hierarchy**: Foreground elements (modals, overlays) move faster than background elements (workspaces).
- **Focus Transitions**: When focus shifts via keyboard navigation, the focus ring must transition smoothly, drawing the eye to the new active element.
- **Panel Movement**: Docking, splitting, or resizing panes must smoothly interpolate the layout grid to prevent jarring content reflows.
- **Detached Windows**: Moving an artifact into an OS-level detached window should cross-fade the local element out while the OS window spawns.

---

## 7. Reduced Motion

PRISM natively respects the host OS "Reduced Motion" preference, prioritizing accessibility. 

When reduced motion is enabled, PRISM preserves the semantic meaning of the state change without relying on physical movement:

- **Opacity**: Fade transitions replace spatial sliding.
- **Color**: Semantic color shifts replace continuous ambient animations.
- **Scale**: Modals appear instantly rather than zooming from an origin point.
- **Layout**: Panes snap to their new sizes instantly rather than smoothly interpolating.

Meaning is never removed; it is simply translated to static or low-frequency visual cues.

---

## 8. Performance Principles

PRISM is a high-performance operating system. Motion must never reduce responsiveness or steal cycles from the Kernel.

- **GPU-Friendly Philosophy**: Motion must exclusively target properties that do not trigger layout reflows on the main thread (e.g., Transforms, Opacity).
- **Asynchronous Rendering**: UI animations must run independently of Kernel processing threads.
- **No Blocked UI Thread**: Long-running or complex layout animations must be abandoned if they threaten to drop the interface frame rate below 60fps.
- **Graceful Degradation**: If the system detects high CPU/Memory load, ambient animations (like Milly's idle state) must automatically downgrade to static renders to preserve resources for execution.

---

## 9. Motion Anti-Patterns

To maintain its identity as a precise tool, PRISM interfaces must NEVER adopt:

- **Decorative Motion**: Elements animating without a corresponding data or state change.
- **Bounce Animations**: Overly playful physics, elastic easing, or "spring" effects on standard UI elements.
- **Exaggerated Easing**: Easing curves that linger too long or accelerate artificially.
- **Fake Loading**: Spinners or progress bars programmed to delay rendering for dramatic effect.
- **Looping Distractions**: High-frequency animations running continuously outside of a critical error state.
- **Random Particle Effects**: Confetti, fireworks, or celebratory explosions upon success.
- **Animation without Meaning**: Moving something purely to fill empty space.

---

## 10. Future Extensibility

The motion language is designed as an abstract specification, allowing platform-specific implementations (e.g., CSS transitions on Web, CoreAnimation on macOS, Framer Motion in React). 

Regardless of the underlying technology stack, all future interfaces must map precisely to these semantic categories. When the PRISM Kernel emits a `STATE_TRANSITION: PLANNING` event via the Event Bus, every connected shape (Desktop, Web, or Mobile) will execute its platform-native interpretation of the "Planning" motion rules.
