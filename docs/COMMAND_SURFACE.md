# PRISM Command Surface Architecture

## Overview
This document defines the permanent command architecture for PRISM. It serves as the definitive specification for how users interact with the system via commands across all interfaces (Desktop, Web, CLI). 

Following the principle of **One Mind. Infinite Shapes**, the command system is decoupled from the UI. Interfaces provide the visual surface (like the Command Palette), but the command execution logic, registry, and state are strictly managed by the PRISM Kernel.

---

## 1. Philosophy

Commands are a first-class interaction model in PRISM. While GUIs are excellent for visualization, commands are the fastest, most precise way to instruct the system.

- **Keyboard-First Workflow**: Every action achievable with a mouse click must be achievable via a command shortcut. Power users should never be forced to leave the keyboard.
- **Universal Accessibility**: Commands provide a structured, screen-reader friendly, and highly predictable path to execute complex workflows.
- **Context Awareness**: Commands adapt to the user's focus. The system does not overwhelm the user with irrelevant commands.
- **Discoverability**: Commands must be self-documenting. Fuzzy search, aliases, and natural language mapping ensure users can easily find the exact action they need.
- **Deterministic Behavior**: A command with the same arguments executed in the same context must always yield the exact same behavior. Side effects are strictly isolated.

---

## 2. Command Palette

The Command Palette is the primary interface for command execution. 

- **Global Invocation**: Triggered universally via `Ctrl+K` / `Cmd+K`.
- **Context-Sensitive Commands**: The palette detects the active pane, workspace, and selection. If a code editor is focused, "Format Document" appears first. If the Execution Graph is focused, "Pause Pipeline" is prioritized.
- **Search Behavior**: Instant fuzzy matching against command titles, descriptions, aliases, and natural language synonyms.
- **Ranking Philosophy**: Results are ranked by:
  1. Exact alias matches.
  2. Context relevance (focused pane/artifact).
  3. Frequency of historical usage.
  4. Alphabetical order.
- **Command Categories**: Commands are grouped by namespace (e.g., `workspace:new`, `memory:search`).
- **Recent Commands**: The default state of the empty palette displays the 5 most recently executed commands.
- **Favorites & Pinned Commands**: Users can pin highly utilized commands to the top of the palette or map them to custom keyboard shortcuts.

---

## 3. Universal Search

The Command Palette doubles as PRISM's Universal Search engine. 

- **Scope**: Supports searching across Projects, Sessions, Artifacts, Memories, Local Files, Code Symbols, Registered Commands, Tools, Models, and Settings.
- **Prioritization**: When a user types a generic query, PRISM prioritizes:
  1. Actionable commands (e.g., "Create new project").
  2. Active context artifacts (files currently open).
  3. Recent sessions.
  4. Global memories and historical artifacts.
- **Semantic Mapping**: If an exact file or command isn't found, the search queries the Memory Engine to provide semantically relevant artifacts or suggest a goal-oriented execution.

---

## 4. Command Types

To maintain organization, all commands belong to a defined category namespace:

- **Navigation**: Jumping between panes, switching workspaces, viewing recent sessions.
- **Workspace**: Creating projects, splitting panes, saving layouts, managing active context.
- **Execution**: Starting goals, pausing/resuming pipelines, retrying failed tasks.
- **Memory**: Querying the Memory Engine, forcing index updates, pruning old context.
- **Models**: Switching active routers, comparing provider limits, benchmarking models.
- **Tools**: Inspecting tool schemas, enabling/disabling tools in a workspace.
- **Files**: Opening local artifacts, saving diffs, triggering external editors.
- **Settings**: Toggling themes, editing keybindings, updating API keys.
- **Debugging**: Tailing logs, viewing raw JSON payloads, inspecting event bus streams.
- **System**: Kernel restarts, plugin reloads, system health checks.

---

## 5. Context Awareness

Commands are strictly validated against the active environment before they are displayed.

- **Focused Pane**: A command requiring a text selection will not render if the dashboard is focused.
- **Active Workspace**: Workspace-specific commands are hidden if no project is loaded.
- **Selected Artifact**: Commands like "View Diff" only appear if a versioned artifact is selected.
- **Running Execution**: While an execution is active, "Pause Execution" is available, but "Start Execution" is hidden to prevent state collisions.
- **User Mode**: Expert commands (e.g., "Flush Event Bus") are hidden in Beginner mode but remain accessible if explicitly searched.
- **Permissions**: If a tool is restricted by a Workspace policy (e.g., no filesystem writes), its related commands are disabled and marked visually as locked.
- **Impossibility**: Commands must *never* appear if they are mathematically or physically impossible to execute in the current state.

---

## 6. Execution Model

Commands are dispatched to the PRISM Kernel via the Event Bus and follow standard execution lifecycles.

- **Synchronous Commands**: Fast UI state updates (e.g., "Split Pane", "Toggle Theme"). Block the UI thread for `< 16ms`.
- **Asynchronous Commands**: API calls or database queries (e.g., "Fetch Models"). Display an inline loading indicator.
- **Background Commands**: Data indexing or heavy computations. Detached from the palette immediately, returning a passive notification upon completion.
- **Cancellable Commands**: Any command running longer than `500ms` must support cancellation.
- **Long-Running Commands**: Pushed to the Execution Runtime as a formal Session task, emitting progress events.

### Command Lifecycle States:
1. `Queued`: Awaiting execution slot.
2. `Running`: Actively executing.
3. `Paused`: Suspended (for long-running execution commands).
4. `Cancelled`: Aborted by user.
5. `Succeeded`: Finished normally.
6. `Failed`: Encountered an error, displaying stack trace and recovery options.

---

## 7. Extensibility

The command architecture is designed for infinite modularity.

- **Plugin Registration**: Future IDE extensions, MCP servers, and custom plugins can register new commands dynamically without modifying the PRISM Kernel source code.
- **Namespacing**: Third-party commands must use a distinct namespace prefix (e.g., `mcp-github:create-pr`).
- **Metadata**: Every registered command provides a schema defining its required arguments, descriptions, aliases, and trigger contexts.
- **Capabilities**: Plugins must declare the capabilities they require to register a command, ensuring security boundaries are maintained.
- **Versioning**: Command schemas are versioned to support backwards compatibility when plugin APIs evolve.

---

## 8. Discoverability

A command system is only as good as its discoverability.

- **Fuzzy Search**: Tolerates typos and out-of-order keywords.
- **Aliases**: Common abbreviations (e.g., `np` for `New Project`).
- **Natural Language Mapping**: Typing "make it dark" maps to the `settings:toggle-dark-mode` command.
- **Command Descriptions**: Every command displays a concise, single-line description explaining its exact effect.
- **Usage Examples**: For commands requiring arguments, the palette displays a placeholder hint or a dropdown of valid examples.
- **Recently Used**: Heavily utilized commands naturally float to the top of the default palette view.

---

## 9. Accessibility

The Command Surface is the ultimate accessibility tool.

- **Complete Keyboard-First Interaction**: Absolutely no mouse interaction is required to trigger any system capability.
- **Keyboard Navigation**: Standard `Up/Down` arrow traversal, `Enter` to execute, `Esc` to dismiss, and `Tab` for argument auto-completion.
- **Screen Readers**: The palette utilizes ARIA live regions to announce search results, active selections, and execution states.
- **Focus Behavior**: Opening the palette traps focus instantly. Closing it returns focus perfectly to the previously active pane or artifact.
- **Shortcut Customization**: Every command in the system can be mapped, unmapped, or remapped to custom keyboard chords via a centralized settings file.

---

## 10. Anti-Patterns

To maintain the architectural integrity of PRISM, all current and future interfaces must strictly avoid the following command behaviors:

- **Hidden Commands**: Never implement a critical workflow that can only be accessed via an obscure mouse click. If it exists in the UI, it must exist in the Command Registry.
- **Duplicate Commands**: Never register multiple commands that do the exact same thing under different names. Use aliases instead.
- **Provider-Specific Commands**: Never hardcode commands like `OpenAI: Generate`. Use agnostic commands like `Models: Generate` which map to the active router.
- **Modal Overload**: Never chain multiple blocking modal prompts inside a command execution. Favor inline argument parsing in the palette.
- **Command Side Effects**: Commands must do exactly what they describe, nothing more. A command to "Save Layout" should not also "Refresh Browser."
- **Inconsistent Naming**: Stick to the `namespace:verb-noun` standard. Never mix formats (e.g., `create_file`, `FileDelete`).
- **Non-Deterministic Execution**: A command executed in the exact same state must always yield the exact same result. Eliminate race conditions in command dispatching.
