# PRISM Interaction Language

## Overview
This document defines how PRISM communicates information to its users across all interfaces (Desktop, Web, CLI). It serves as the permanent interaction specification for PRISM, focusing on communication philosophy, progressive disclosure, and the semantic language of the system.

PRISM's interface is built on the tenet: **One Mind. Infinite Shapes.** The Kernel retains all intelligence; the Interface owns the experience.

---

## 1. Communication Philosophy

PRISM communicates as a high-performance, intelligent operating system. It does not mimic human dialogue.

- **Precision over Personality**: PRISM delivers exact data, execution metrics, and context logs. It does not use conversational filler, emojis, or polite pleasantries.
- **Confidence over Certainty**: The system acknowledges ambiguity. When uncertain, PRISM presents confidence scores and alternative routing paths rather than attempting to guess with fake certainty.
- **Transparency over Abstraction**: Nothing is hidden. If an execution takes 10 seconds, PRISM reveals the sub-tasks that consumed the time.
- **Calm over Noisy**: Communication happens contextually. PRISM remains silent when executing background tasks successfully, only elevating notifications when user intervention is required.
- **Progressive Disclosure**: Information density scales by user demand. The default view is summarized and calm, but the user can infinitely drill down into raw logs and stack traces.
- **Machine-First**: PRISM is a machine. Its communication is human-readable, highly structured, and deterministic. It never pretends to have emotions.

---

## 2. Cognitive State Language

Every state of the PRISM Kernel maps to a specific visual and communicative semantic.

| State | User-Facing Meaning | Visual Philosophy | Information Hierarchy | Transition Expectations |
|-------|---------------------|-------------------|-----------------------|-------------------------|
| **Idle** | System is online, awaiting input. | Calm, low opacity, static or very slow pulse. | System metrics (RAM, Kernel status) visible. | Instantly transitions to 'Thinking' on input. |
| **Thinking** | Processing intent, parsing NLP. | Fluid, moderate activity. | Current parsing stage (e.g., "Extracting Goal"). | Progresses to 'Planning' or 'Routing'. |
| **Planning** | Building the Execution Plan. | Structural, expanding nodes. | Number of tasks generated, dependency graphs forming. | Transitions to 'Routing' or 'Tool Execution'. |
| **Memory Retrieval** | Searching vector/graph stores for context. | Scanning, sweeping visuals. | Database name, query semantic, latency. | Yields to 'Planning' upon context injection. |
| **Routing** | Selecting the optimal model provider. | Rapid switching/connecting. | Selected model, rationale (cost vs. capability). | Transitions to 'Tool Execution'. |
| **Tool Execution** | Actively running code or interacting with OS. | High energy, solid primary colors. | Active tool name, stdout stream, elapsed time. | Transitions to 'Success', 'Failure', or 'Waiting'. |
| **Reflection** | Validating output against intent. | Slowing down, comparative visuals. | Validation criteria, pass/fail status. | Transitions to 'Success' or 'Planning' (if retrying). |
| **Validation** | Requires explicit human approval. | Halted, high contrast, pulsing border. | Diff view, required input prompt, cost estimate. | Blocked until user confirms or cancels. |
| **Waiting** | Suspended for background task. | Dimmed, minimized. | Timer, background task name. | Awakes upon task completion or event trigger. |
| **Success** | Execution completed successfully. | Brief positive burst, then returns to Idle. | Final artifact link, total execution time, cost. | Returns to 'Idle'. |
| **Partial Success**| Pipeline finished with non-critical failures. | Amber indicator, mixed nodes. | Completed artifacts, list of skipped/failed optional tasks. | Returns to 'Idle'. |
| **Failure** | Critical task failed, halting pipeline. | Sharp, destructive colors (Red), static. | Stack trace, failing node, error code, recovery options. | Requires user intervention to reset or retry. |
| **Interrupted** | User cancelled the operation. | Grayed out, struck-through. | Cancellation timestamp, state of rollback. | Returns to 'Idle'. |
| **Paused** | Operator suspended the session. | Static, high-contrast pause icon. | Resume button, current suspended state memory. | Blocked until 'Resume' or 'Cancel'. |

---

## 3. Confidence Language

Confidence is communicated as actionable data, never as arbitrary percentages. 

- **Confidence Score**: Displayed as high/medium/low semantic badges (e.g., "High Confidence: Exact capability match").
- **Trust Score**: Based on historical success rates of the chosen model/tool for similar tasks. Displayed when selecting models.
- **Verification State**: Explicitly marks outputs as "Unverified" (needs user review) or "Verified" (passed automated tests or human review).
- **Uncertainty & Assumptions**: If PRISM lacks context, it lists its assumptions explicitly (e.g., *"Assuming Next.js App Router based on presence of `app/` directory"*).
- **Missing Context**: PRISM highlights missing knowledge graph nodes and requests missing files if they are critical to execution.

---

## 4. Memory Communication

Memory is visually treated as an active participant in reasoning.

- **Memory Retrieval**: A dedicated pane or log entry shows *exactly* what memories were pulled (e.g., *"Retrieved 3 snippets from previous database migration session"*).
- **Memory Creation**: Explicit visual confirmation when PRISM commits a new success path to memory (e.g., *"Procedural Memory Indexed: Next.js Tailwind Setup"*).
- **Memory Types**:
  - *Procedural*: How to do a task (Tool chains).
  - *Semantic*: Facts about the workspace (Frameworks used).
  - *Episodic*: Past events (Previous errors encountered).
- **Trust Weighting**: Memories display a decay/trust weight, explaining *why* an older memory might be overridden by a newer one.

---

## 5. Reasoning Visibility

Information is presented through strict **Progressive Disclosure**:

1. **Collapsed**: Simple status (e.g., "Generating Frontend Components...").
2. **Summary**: A paragraph describing the chosen strategy and models.
3. **Planner**: The high-level Execution Plan (Phases and Checkpoints).
4. **Execution Graph**: The visual node graph of dependent Tool Execution tasks.
5. **Tool Details**: The exact inputs, arguments, and expected outputs of a specific tool.
6. **Raw Logs**: Real-time stdout/stderr streaming from the tool executor.
7. **Stack Traces**: The raw, unformatted error output from the host OS or provider.

Users define their own depth. The UI never forces an expert to click 5 times to see a stack trace, nor does it overwhelm a beginner with raw JSON.

---

## 6. Tool Communication

Tool execution states are deterministic and clearly mapped:

- **Queued**: Waiting for dependent tasks.
- **Running**: Actively utilizing CPU/Network. Real-time duration timer visible.
- **Retrying**: Failed once, executing retry policy. Displays attempt count (e.g., "Attempt 2/3").
- **Cancelled**: Aborted by user or cascading failure.
- **Succeeded**: Returned expected schema or 0 exit code.
- **Failed**: Exited with non-zero code or failed validation.
- **Skipped**: Bypassed due to strategy rules or upstream failure.

---

## 7. Error Language

Errors in PRISM are technical facts. They are never obfuscated behind "Oops!" or "Something went wrong."

- **Recoverable Failures**: The tool failed, but PRISM has a fallback plan or retry policy. Displayed in Amber.
- **Unrecoverable Failures**: Halts the pipeline. Displayed in Red. Requires user intervention.
- **Failure Types**:
  - *Dependency*: Upstream task failed.
  - *Model*: LLM output failed schema parsing or hallucinated.
  - *Provider*: API rate limit or timeout.
  - *Local*: Filesystem permission denied, binary not found.
- **Presentation**: Always present the raw stack trace or raw API response, accompanied by a generated "Recovery Action" button (e.g., "Retry", "Edit Plan", "Run manually").

---

## 8. Notification Philosophy

PRISM operates on a strict "No Spam" policy.

- **Passive Notifications**: Small, transient toasts or status bar updates for background completions (e.g., "Memory Index Updated"). They auto-dismiss and do not require interaction.
- **Actionable Notifications**: Persistent indicators requiring user input (e.g., "Validation Required for Git Commit"). These remain until dismissed or resolved.
- **Critical Notifications**: Modal or full-pane takeovers. Used only for unrecoverable pipeline crashes or system-level connection failures.
- **Long-Running Workflows**: Sent to the background silently. When complete, a single Passive Notification is emitted.

---

## 9. Information Density

The Kernel remains identical across all modes. Only the UI presentation density shifts based on user preference:

- **Beginner Mode**: Shows 'Summary' and 'Execution Graph' by default. Auto-collapses raw logs. Focuses on artifacts produced.
- **Standard Mode**: Shows 'Planner' and 'Tool Details'. Errors automatically expand to show stack traces.
- **Expert Mode**: Bypasses summaries. Defaults to split-pane 'Execution Graph' and 'Raw Logs'. Metrics (latency, token count, cost) are pinned globally.

---

## 10. Anti-Patterns

PRISM interfaces must NEVER adopt these interaction behaviors:

- **Fake Typing Indicators**: Never simulate keystrokes (`...`) to mimic human typing. Render streaming tokens as fast as the network provides them.
- **Artificial Waiting**: Never introduce delays (e.g., `sleep(1)`) to make the system appear as if it is "thinking deeply." Speed is paramount.
- **Fake Emotions**: Never use phrases like *"I'm sorry,"* *"I think,"* or *"I feel."* Use *"Execution failed,"* *"Confidence low,"* or *"Routing determined."*
- **Exaggerated Animations**: Avoid bouncy, cartoonish, or overly complex transitions. Keep motion functional, brief, and tied strictly to data state changes.
- **Hidden Reasoning**: Never output an artifact without linking to the Execution Graph that produced it.
- **Meaningless Badges**: Do not show "99%" confidence unless that metric is tied to a specific benchmark, validation suite, or trust score mathematical formula.
- **Random AI Personality**: PRISM does not have a quirky personality. It is a precise operating system.
