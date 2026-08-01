# PRISM Milly Experience Architecture

## Overview
This document defines the permanent specification for **Milly**, PRISM's visual cognitive presence. It governs her purpose, behavior, and limitations across all current and future interfaces (Desktop, Web, Mobile, CLI).

**Critical Rule:** Milly is a visualization of the PRISM Kernel. She is NOT a character. She is NOT a mascot. She is NOT a chatbot companion. She exists exclusively to communicate cognition.

---

## 1. Purpose

Milly exists to solve the "black box" problem of autonomous systems. When a highly intelligent Kernel is processing vast amounts of data, humans need a focal point to understand its state.

- **Cognitive Presence**: Milly represents the active, thinking state of the system, giving the user an ambient awareness of PRISM's internal operations.
- **System State Visualization**: She acts as the ultimate status indicator, mapping complex backend transitions (e.g., Memory Retrieval -> Planning -> Routing) to intuitive visual cues.
- **Execution Awareness**: She signals when the system is working, blocked, or requires human intervention.
- **Attention Guidance**: She gently draws the user's eye to critical validation prompts or pipeline failures without being disruptive.

Milly never replaces the structural interface. She is a complementary layer.

---

## 2. Presence

Milly's presence is strictly governed by utility. Silence is preferable to unnecessary noise.

- **When She Appears**: Milly is visible in a localized, ambient state (e.g., Top Toolbar, CLI prompt, or Status Bar) when the Kernel is online and actively tracking a session.
- **When She Disappears**: If the system is asleep, disconnected, or operating in strict CLI headless mode, Milly vanishes. 
- **Ambient Behavior**: When PRISM is idle, Milly operates in a low-opacity, near-invisible state.
- **Active Behavior**: When PRISM is executing a Goal, Milly becomes highly visible, mutating to reflect the active cognitive phase.
- **Background Behavior**: If PRISM is executing long-running background tasks while the user works, Milly shrinks to a minimal indicator to avoid distraction.

---

## 3. State Mapping

Milly's visual behavior maps precisely 1:1 with the PRISM Kernel state machine.

| Kernel State | Purpose | Visual Behavior | Transition Philosophy | Attention Level |
|--------------|---------|-----------------|-----------------------|-----------------|
| **Idle** | Awaiting user intent. | Slow, low-contrast breathing. | Smooth cross-fade to active states. | **Zero**. Must not distract. |
| **Thinking** | Parsing intent / NLP evaluation. | Fluid, morphing wave state. | Immediate snap to indicate engagement. | **Low**. Ambient awareness. |
| **Planning** | Generating Execution Plan. | Geometric, grid-based splitting. | Structural unfolding. | **Medium**. Signals complex upcoming work. |
| **Memory Retrieval** | Vector/Graph searching. | Sweeping, radar-like pulses. | Inward or outward radial motion. | **Low**. |
| **Routing** | Selecting optimal provider. | Rapid, sharp snapping between vertices. | High-frequency switching. | **Low**. Usually resolves quickly. |
| **Execution** | Running active tools. | High-energy, solid primary color spinning. | Continuous motion tied to stdout speed. | **Medium**. Indicates active local/remote work. |
| **Reflection** | Validating output vs Goal. | Comparative, side-by-side sliding. | Slower, measured oscillation. | **Medium**. |
| **Validation** | Blocked pending human approval. | High contrast, bright pulsing boundary. | Halted motion. | **High**. Requires interaction. |
| **Waiting** | Suspended for background task. | Dimmed, minimized static icon. | Collapses from active state. | **Zero**. |
| **Paused** | Operator suspended session. | Frozen cut. No motion. | Instant halt. | **Low**. |
| **Interrupted**| User aborted execution. | Immediate collapse / fade out. | Fast regression to Idle. | **Low**. |
| **Success** | Goal achieved. | Brief, bright outward burst. | Settles instantly to Idle. | **Low**. Brief acknowledgment. |
| **Failure** | Unrecoverable error. | Sharp, jagged, high-frequency glitch (Red). | Jarring transition. | **High**. Signals broken state. |

---

## 4. Relationship with the User

Milly represents a highly capable, autonomous operating system. She interacts with the user as a precision tool.

- **Trust**: Earned through exact, deterministic behavior. If Milly glitches red, the user knows exactly why (a pipeline failed), not because she is "upset."
- **Transparency**: She never obfuscates the Kernel's actions. If she is "Thinking," the UI must allow the user to click her to see exactly what she is processing.
- **Authority**: She commands attention only when safety or validation is required.
- **Guidance**: She points users toward solutions (e.g., highlighting a recovery button on failure).
- **Restraint**: She never simulates emotions, uses conversational filler, or acts like a companion.

---

## 5. Relationship with the Interface

Milly is the "ghost in the machine." The interface remains the primary structural boundary; Milly lives within it.

- **Execution Graph**: Milly's state dictates the color and motion of active graph nodes.
- **Command Palette**: She lives alongside the search input, reacting to query parsing speed.
- **Workspace**: She hovers in designated safe zones (toolbars, status bars) without overlapping critical code or data views.
- **Notifications**: She acts as the anchor point for transient passive notifications.
- **Panels**: She never obscures panel content. If space is constrained, she scales down.

---

## 6. Attention Economy

Milly must never compete with the user's primary work.

- **Attention Rules**: Milly operates at `10%` visual hierarchy during 'Idle' and 'Retrieval', `50%` during 'Execution', and `100%` ONLY during 'Validation' and 'Failure'.
- **Interruption Policy**: She may never force a modal takeover or steal keyboard focus unless a critical Kernel-level failure requires immediate user confirmation to prevent data loss.
- **Notification Hierarchy**: Standard background completions trigger a passive ambient state change. They do not trigger sound or flashing.

---

## 7. Accessibility

Milly's visual implementation must respect global accessibility constraints:

- **Reduced Motion**: If enabled by the OS, Milly ceases all fluid morphing and spinning. She communicates Kernel states entirely through static opacity, scale, and semantic color shifts.
- **Color Accessibility**: State colors (Emerald, Amber, Rose, Cyan) must remain distinguishable by colorblind users, supported by distinct geometric shape changes (not just color changes).
- **Screen Reader Behavior**: Milly's state changes map to ARIA live regions, announcing critical shifts (e.g., "PRISM State: Validation Required") without spamming the user during rapid transitions.
- **Low-Power Mode**: On laptops with battery constraints, Milly limits canvas/SVG render loops to `15fps` or switches to a static fallback.

---

## 8. Anti-Patterns

To preserve the architectural identity of PRISM, all current and future interfaces must strictly forbid the following behaviors regarding Milly:

- **Chatbot Avatars**: Do not render Milly as a human face, an animal, or a conversational character.
- **Fake Emotions**: Do not program Milly to act "happy" on success or "sad" on failure. She is a machine; she succeeds or fails deterministically.
- **Eye Tracking**: Do not implement cursors following or "looking" at elements to simulate sentience.
- **Idle Fidgeting**: Do not program random animations (e.g., bouncing, yawning) while waiting for input. Idle means idle.
- **Unnecessary Speech**: Milly does not use text bubbles to say "I'm working on it!"
- **Attention Seeking**: Never use shaking, flashing, or bouncing to beg the user to use a feature.
- **Gamification**: Do not award points or trigger celebratory confetti tied to Milly's state.
- **Virtual Pet Behavior**: Users do not "feed," "care for," or "befriend" Milly. 

---

## 9. Future Extensibility

Milly's architectural purpose is designed to scale infinitely across any interface shape:

- **Desktop**: Rendered as a WebGL orb, SVG node, or Canvas element in the Top Toolbar.
- **Web**: A lightweight CSS/SVG indicator near the user profile or workspace header.
- **Mobile**: A compact dynamic island or status bar icon.
- **CLI**: A specialized spinner or Unicode glyph (e.g., `[≋]`) that mutates based on state.
- **IDE Integrations**: A minimal status bar item (e.g., VS Code status bar icon) that changes color and rotation.
- **AR/VR**: A 3D geometric node anchored to the spatial workspace perimeter.

Regardless of the medium, the Kernel emits the state, and the interface simply renders the corresponding visual protocol.
