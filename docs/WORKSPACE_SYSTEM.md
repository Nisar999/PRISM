# PRISM Workspace System

## Overview
This document defines the persistent workspace model for PRISM. It serves as the architectural specification for workspace management across all PRISM interfaces. The Workspace System ensures context isolation, seamless resumption of work, and strict local-first data ownership.

---

## 1. Workspace Philosophy

- **Why Workspaces Exist**: Workspaces provide a rigid boundary for cognitive context. Rather than blending distinct tasks (e.g., "Refactor Frontend" and "Write Deployment Script") into an ambiguous chat history, Workspaces ensure PRISM only accesses memories, tools, and history relevant to the specific project at hand.
- **Workspace Lifecycle**: A workspace persists indefinitely until explicitly archived or deleted. It holds the complete history of an intent from inception to completion.
- **Workspace Isolation**: What happens in one workspace does not leak into another, except through explicitly shared, global Memory Engine abstractions (e.g., learned system-wide skills).
- **Local-First Persistence**: Workspace definitions, session states, layout configurations, and artifacts are stored locally on the user's filesystem (e.g., within `.prism/workspaces/`). Cloud sync is an optional future capability, never a requirement.

---

## 2. Project Model

A **Project** is the highest level of organization within the Workspace System.

- **Projects**: Distinct folders containing a unified goal or encompassing a specific repository.
- **Collections**: Logical groupings of Projects (e.g., "Client Work," "Open Source," "Experiments").
- **Tags**: Semantic labels applied to Projects for quick filtering via the Command Palette.
- **Metadata**: Each Project maintains a `project.json` file detailing creation date, last active timestamp, bounded toolsets, and base directory paths.
- **Ownership**: The user owns the Project directory. PRISM acts as a collaborator with bounded read/write scopes.
- **Templates**: Users can instantiate new Projects from Templates (e.g., "Standard Web App Context," "Data Science Environment"), pre-loading necessary system prompts, memory configurations, and tool restrictions.

---

## 3. Session Model

A **Session** represents a continuous, focused engagement within a Project.

- **Session Lifecycle**: A session begins when an intent is formulated and ends when the goal is reached or the user suspends it. Sessions are strictly linear in execution but can branch contextually.
- **Active Sessions**: A Project can have exactly one active session at a time in a given UI window.
- **Archived Sessions**: Completed sessions are stored in an immutable history log, preserving the exact context, tool outputs, and artifacts generated during that time.
- **Forking Sessions**: Users can fork an archived or active session to explore an alternate strategy without destroying the original execution path.
- **Session History**: An immutable graph of all steps (Intent -> Planner -> Execution). It is fully navigable and searchable.
- **Resume Behavior**: Upon re-opening a suspended Project, the UI perfectly restores the exact state of the Active Session, including unexecuted queue tasks, partial tool outputs, and in-memory context.

---

## 4. Artifact System

**Artifacts** are the tangible outputs of a Session (e.g., code snippets, documentation, architecture diagrams).

- **Artifact Types**: Standardized types include `Code`, `Markdown`, `Mermaid`, `JSON`, `Diff`, and `Log`.
- **Relationships**: Artifacts are intrinsically linked to the `ExecutionTask` that produced them.
- **Version History**: Artifacts support linear versioning. If an agent overwrites an artifact, the previous state is preserved locally as a revision.
- **Provenance**: The UI must always provide a "Show Origin" action, tracking an artifact back to the exact prompt, model, and tool chain that generated it.
- **References**: Artifacts can cross-reference each other (e.g., an Architecture Diagram artifact referencing a Code artifact).
- **Pinning and Favorites**: Important artifacts can be pinned to the Project Dashboard to prevent them from being lost in the session history.

---

## 5. Workspace Layout

The Workspace System mandates a highly customizable, persistent layout architecture.

- **Pane Persistence**: The exact arrangement, sizing, and content of panes (e.g., Editor, Execution Graph, Raw Logs) are persisted locally per-Project.
- **Docking Rules**: Panes can be docked to the Left, Right, Bottom, or Main center stages.
- **Split Views**: Unlimited horizontal and vertical splitting is supported, heavily utilized for diffing artifacts.
- **Saved Layouts**: Users can save and quickly switch between predefined layouts (e.g., "Review Mode," "Execution Mode," "Debug Mode").
- **Multi-Monitor Behavior**: When panes are torn off into independent OS windows, the Workspace System tracks their coordinates. Restoring the Project restores the multi-monitor arrangement automatically.

---

## 6. Context Boundaries

Context isolation ensures high-quality reasoning and prevents hallucination bleed-over.

- **Memory Scope**: By default, PRISM searches Project-scoped memory first, then falls back to Global-scoped memory. 
- **Tool Scope**: Tool access can be restricted per-Project (e.g., disabling `terminal_exec` for a read-only documentation Project).
- **Model Scope**: Specific Projects can enforce specific model routers (e.g., forcing a local LLM for a highly sensitive Project).
- **Shared vs Isolated Context**: Context fragments (files, URLs, environment variables) explicitly loaded into a Project are strictly isolated from others.
- **Context Inheritance**: Forked sessions inherit the exact context snapshot of their parent session at the moment of the fork.

---

## 7. Collaboration Readiness

While PRISM is currently a single-user system, the architecture guarantees multi-user extensibility.

- **Immutable Logs**: Because Session histories and Artifacts are immutable append-only logs, they map perfectly to CRDTs (Conflict-free Replicated Data Types) for future real-time collaboration.
- **Stateless UI**: The UI reacts to state events from the Kernel. In a future multi-user scenario, multiple UI clients can subscribe to the same Kernel Event Bus without architectural rewrites.
- **Agent Collaboration**: The isolated Workspace structure provides a sandbox where multiple autonomous agents (sub-agents) can operate within the same Session concurrently.

---

## 8. Import / Export

Workspaces must be highly portable to avoid vendor lock-in and enable environment sharing.

- **Portable Workspace Bundles**: Projects can be packed into a compressed archive (`.prismpack`), containing all artifacts, session history, memory vectors (or their text equivalents), and metadata.
- **Backup Strategy**: Automatic rolling backups of the active `session.json` state ensure no loss of execution context in the event of an OS crash.
- **Restore Behavior**: Dragging a `.prismpack` into the application instantly restores the full Workspace.
- **Migration Philosophy**: Schema upgrades to the Workspace data model must provide automated, forward-only migration paths via the Kernel.

---

## 9. Workspace Events

The Workspace System relies on an event-driven lifecycle communicated via the Event Bus.

- **Created**: A new Project and its initial constraints are initialized on disk.
- **Opened**: The UI binds to a Project; the Context Engine hydrates the active context.
- **Suspended**: The UI unbinds; in-flight tasks may be paused; state is flushed to disk.
- **Resumed**: Context is restored; paused execution tasks are queued for restart.
- **Archived**: The Project is compressed or marked read-only. Memory scopes are de-prioritized.
- **Deleted**: Hard deletion of all local artifacts, session logs, and Project-specific memories.
- **Imported / Exported**: Hydration from or serialization to a `.prismpack` bundle.

---

## 10. Anti-Patterns

To preserve the utility, predictability, and architectural philosophy of PRISM, all current and future interfaces must strictly avoid the following Workspace behaviors:

- **Infinite Unnamed Chats**: Never dump executions into an endless, unlabeled, generic thread. Every engagement belongs to a structured Session within a defined Project.
- **Hidden Project State**: Do not obscure where data is saved. Users must always know the local path to their workspace on their filesystem.
- **Implicit Context Switching**: Never silently shift context scopes. If the user searches a memory from a different Project, the UI must explicitly notify them of the cross-boundary request.
- **Irrecoverable Deletion**: Avoid hard-deleting artifacts or sessions without first offering a local snapshot or "Trash" recovery mechanism.
- **Provider-Dependent Workspaces**: Never tie a workspace configuration strictly to a cloud provider's proprietary format. The Workspace schema remains 100% owned by PRISM and completely local.
