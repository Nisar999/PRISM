# PRISM Visual Cognition Architecture

## Overview
This document defines how the invisible cognitive processes of the PRISM Kernel are translated into semantic visual information across all interfaces. It governs the visual meaning of data, ensuring that users can intuitively read the system's reasoning without being overwhelmed by raw logs.

Following the principle of **One Mind. Infinite Shapes.**, this specification defines *what* is visualized, leaving the *how* (CSS, Canvas, WebGL, CLI glyphs) to the specific interface implementation.

---

## 1. Philosophy

Cognition must be made visible to build trust. If a user cannot see *how* PRISM arrived at a decision, they cannot trust the outcome.

- **Reasoning**: Visualized as a traversable path of logic.
- **Planning**: Visualized as structural intent before execution.
- **Trust**: Visualized as weight or decay applied to data.
- **Memory**: Visualized as retrieved contextual anchors.
- **Execution**: Visualized as active deterministic state changes.
- **Reflection**: Visualized as comparative analysis against a goal.

Visuals exist exclusively to explain cognition. They are never decorative. If a visual element does not convey semantic meaning about the Kernel's state, it must be removed.

---

## 2. Cognitive Objects

Every major concept in PRISM is treated as a semantic visual object.

- **Intent**: The raw, unstructured user input. Visually represented as a singular, unified origin point.
- **Goal**: The parsed, machine-readable objective. Visually represented as a fixed destination or target state.
- **Plan**: The structured strategy to reach the goal. Visually represented as an ordered sequence of required capabilities.
- **Task**: An atomic unit of work within a plan. Visually represented as a discrete, actionable node.
- **Memory**: Context retrieved from the past. Visually represented as linked references anchored to the current context.
- **Context**: The active data boundary. Visually represented as a container or bounding box enclosing relevant objects.
- **Tool**: An executable capability. Visually represented as a strict interface with defined inputs and outputs.
- **Execution**: The act of running a tool. Visually represented as a live, streaming state change on a Task node.
- **Reflection**: Evaluating an output. Visually represented as a bi-directional comparison between an Artifact and a Goal.
- **Validation**: Human approval. Visually represented as a hard blocker or gateway requiring explicit interaction.
- **Trust**: The historical reliability of an object. Visually represented as opacity, thickness, or weight (e.g., higher trust = bolder lines).
- **Artifact**: A durable output. Visually represented as a solid, permanent block of data.
- **Session**: A continuous engagement. Visually represented as a linear timeline of events.
- **Workspace**: The isolation boundary. Visually represented as the absolute container holding all sessions and context.

---

## 3. Visual Hierarchy

Importance is communicated through strict spatial and styling rules, guiding the user's attention.

- **Position**: Information flows top-to-bottom or left-to-right, matching the arrow of time in an execution sequence.
- **Scale**: The currently active Task or currently focused Artifact is scaled up; inactive elements are scaled down.
- **Grouping**: Tasks belonging to the same Plan phase are visually clustered to reduce cognitive load.
- **Color Semantics**: Color is reserved exclusively for state (Idle, Active, Success, Failure, Validation).
- **Density**: Highly complex data (like raw logs) is physically condensed (smaller font, tighter leading) compared to high-level summaries.
- **Relationships**: Parent objects visually enclose or distinctly point to their children.

---

## 4. Relationship Mapping

Understanding *why* something happened requires visualizing the causal chain.

- **Intent → Plan**: A 1:1 expansion. The singular intent fractures into a structured list.
- **Plan → Tasks**: A 1:N expansion. A single plan step generates a graph of atomic tasks.
- **Tasks → Tools**: A 1:1 binding. A task node explicitly embeds the tool icon/name it invokes.
- **Tools → Artifacts**: A directional flow. Tool execution pipes output directly into a newly minted Artifact block.
- **Artifacts → Memory**: A continuous link. Artifacts are shown with trailing connections indicating they have been indexed into the Memory Graph.
- **Memory → Trust**: A weighted connection. Memories fetched with high trust have thicker visual connections to the active context.
- **Reflection → Validation**: A gating mechanism. Reflection visually blocks the pipeline until the Validation gateway is unlocked.
- **Workspace → Sessions**: A container relationship. Sessions stack chronologically within the Workspace boundary.
- **Sessions → Artifacts**: A historical ledger. A Session timeline physically embeds the artifacts it generated.

---

## 5. Cognitive Graphs

Graph structures are the primary visual mechanism for explaining complex, non-linear reasoning.

- **Execution Graph**: A directed acyclic graph (DAG) showing Tasks and their dependencies. Visualizes parallel vs. sequential execution bottlenecks.
- **Memory Graph**: A node-link diagram showing how retrieved semantic concepts relate to each other and the current Intent.
- **Dependency Graph**: A strict hierarchical tree showing what files/packages must be modified before others.
- **Context Graph**: A radial or clustered visualization showing everything (files, URLs, env vars) loaded into the active boundary.
- **Reasoning Graph**: A decision tree showing alternate paths the Router considered before selecting the optimal strategy.
- **Trust Graph**: A weighted heat map showing which tools or models have the highest historical success rates for the current Goal.

---

## 6. Information Layers

Information is layered to prevent overwhelming the user. They control the depth via progressive disclosure:

1. **Overview**: "The system is building a frontend."
2. **Summary**: "Executing 5 tasks across React and Tailwind."
3. **Structure**: The Execution Graph showing the 5 nodes and dependencies.
4. **Relationships**: Showing that Node 3 relies on the Artifact from Node 1.
5. **Execution**: The live tool streaming state of Node 2.
6. **Evidence**: The specific Memory snippet that caused Node 2 to use a specific Tailwind class.
7. **Raw Data**: The exact JSON payload sent to the LLM and the exact HTTP response.

---

## 7. Visual Semantics

Semantics must remain consistent across all visualizations.

- **Color**: Denotes state (Emerald = Success, Rose = Error, Amber = Pending, Violet = Reasoning).
- **Geometry**: Denotes type (Circles = Agents/Models, Squares = Artifacts/Data, Hexagons = Tools).
- **Grouping**: Denotes scope. Bounding boxes or subtle background fills indicate isolated execution boundaries.
- **Connection**: Denotes dependency. Solid lines are hard dependencies; dashed lines are optional or contextual links.
- **Emphasis**: Denotes active focus. Uses high opacity and sharp borders.
- **Isolation**: Denotes background/inactive context. Uses low opacity and muted borders.
- **Uncertainty**: Denotes low confidence. Visualized via blurred edges, dashed outlines, or explicit warning iconography.
- **Confidence**: Denotes high trust. Visualized via sharp geometry and solid, weighted lines.
- **Validation**: Denotes required interaction. Visualized via pulsing borders or contrasting highlight colors.

---

## 8. Accessibility

Cognitive visualizations must remain universally legible.

- **Reduced Motion**: If motion is disabled, state changes (like node execution) update instantly without animation.
- **High Contrast**: Ensure a minimum WCAG AA contrast ratio between semantic colors and the dark slate background.
- **Colorblind Support**: Color is never the sole indicator of state. Success/Failure must always be accompanied by a distinct geometric shape change or an explicit icon (e.g., checkmark vs. cross).
- **Screen Readers**: Visual graphs must possess an invisible, linearized DOM structure that reads the graph logically (e.g., "Node 2: Compile TypeScript. Dependent on Node 1. Status: Running.").
- **Keyboard Navigation**: Users must be able to use arrow keys to traverse the nodes of an Execution Graph sequentially.

---

## 9. Anti-Patterns

To maintain clarity and trust, PRISM interfaces must NEVER adopt:

- **Decorative Graphs**: Adding a node-link diagram that looks "cool" but does not accurately represent the active memory or execution state.
- **Meaningless Nodes**: Rendering a visual object that cannot be inspected, clicked, or traced back to a specific Kernel entity.
- **Disconnected Visualizations**: Showing data plots that cannot be linked back to the workflow that generated them.
- **Duplicated Information**: Showing the exact same data in a graph and a nearby table without providing a different cognitive perspective.
- **Unexplained Relationships**: Drawing a line between two nodes without offering a way (via hover or click) to see *why* they are connected.
- **Hidden Provenance**: Displaying an output without a visual path back to the tool and prompt that created it.
- **Visual Clutter**: Displaying all 7 Information Layers simultaneously by default.

---

## 10. Future Extensibility

This semantic language is mathematically translatable across dimensions. 

- On a **CLI**, an Execution Graph becomes an indented ASCII tree.
- On the **Web**, it becomes a 2D interactive canvas.
- In **AR/VR**, it becomes a 3D spatial node cluster.

Because the underlying cognitive objects (Task, Memory, Artifact) and their relationships (Dependencies, Trust) are strictly defined, the meaning of the visualization remains perfectly consistent regardless of the shape it takes.
