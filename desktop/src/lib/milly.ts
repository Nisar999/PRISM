/**
 * Milly Engine — sole cognitive presence implementation.
 *
 * Frozen ADR #8: Milly visualizes Kernel/execution cognition; she is not a
 * chatbot avatar. Voice (optional, settings-gated) speaks response content via
 * VoiceManager — it never fabricates character dialogue.
 *
 * State changes are event-driven: store subscriptions + explicit phase signals
 * from the Conversation / Agent pipelines. Success settles when the renderer
 * reports animation complete (no fake settle timers).
 */

import { useSyncExternalStore } from 'react';
import { Store, executionStore, kernelStore, notificationStore, workspaceStore } from './store';
import { agentStore } from './agent';
import { memoryStore } from './memory';
import { providerStore } from './providers';
import { settingsStore } from './settings';

// --- Presence states (production set) ---

export type MillyPresenceState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'planning'
  | 'searching'
  | 'reading'
  | 'coding'
  | 'executing'
  | 'reviewing'
  | 'writing'
  | 'speaking'
  | 'waiting'
  | 'success'
  | 'warning'
  | 'error'
  | 'offline';

/** @deprecated Prefer `searching`. Kept for any residual imports. */
export type LegacyMillyAlias = 'retrieving' | 'routing' | 'reflecting' | 'validation' | 'paused' | 'failure';

export type MillyAttention = 'zero' | 'low' | 'medium' | 'high';

export interface MillyAwareness {
  conversationActive: boolean;
  workspaceName: string | null;
  workspacePath: string | null;
  sessionId: string | null;
  providerId: string | null;
  providerName: string | null;
  providerStatus: string | null;
  model: string | null;
  pipelineState: string;
  activeTaskLabel: string | null;
  memoryHits: number;
  memoryReachable: boolean | null;
  agentStatus: string;
  kernelOnline: boolean;
}

export interface MillyState {
  activeState: MillyPresenceState;
  previousState: MillyPresenceState | null;
  attentionLevel: MillyAttention;
  message: string | null;
  /** Monotonic generation — UI uses this to restart enter animations. */
  generation: number;
  /** Real store-derived awareness (never fabricated). */
  awareness: MillyAwareness;
  /** Optional agent-graph node currently driving presence. */
  activeNode: string | null;
  transitionStartedAt: string;
}

export interface MillyStateSpec {
  attention: MillyAttention;
  statusText: string;
  /** CSS class token for motion language. */
  motion: string;
  /** Semantic color token. */
  tone: 'idle' | 'focus' | 'plan' | 'search' | 'code' | 'run' | 'review' | 'speak' | 'ok' | 'warn' | 'err' | 'off';
}

export const MILLY_STATE_SPECS: Record<MillyPresenceState, MillyStateSpec> = {
  idle: { attention: 'zero', statusText: 'Awaiting instruction', motion: 'breathe', tone: 'idle' },
  listening: { attention: 'low', statusText: 'Listening', motion: 'wave', tone: 'focus' },
  thinking: { attention: 'low', statusText: 'Thinking', motion: 'morph', tone: 'focus' },
  planning: { attention: 'medium', statusText: 'Planning', motion: 'grid', tone: 'plan' },
  searching: { attention: 'low', statusText: 'Searching memory', motion: 'radar', tone: 'search' },
  reading: { attention: 'low', statusText: 'Reading context', motion: 'scan', tone: 'search' },
  coding: { attention: 'medium', statusText: 'Coding', motion: 'pulse-solid', tone: 'code' },
  executing: { attention: 'medium', statusText: 'Executing', motion: 'spin', tone: 'run' },
  reviewing: { attention: 'medium', statusText: 'Reviewing', motion: 'oscillate', tone: 'review' },
  writing: { attention: 'medium', statusText: 'Writing', motion: 'type', tone: 'focus' },
  speaking: { attention: 'low', statusText: 'Speaking', motion: 'speak', tone: 'speak' },
  waiting: { attention: 'zero', statusText: 'Waiting', motion: 'dim', tone: 'idle' },
  success: { attention: 'low', statusText: 'Ready', motion: 'burst', tone: 'ok' },
  warning: { attention: 'high', statusText: 'Attention required', motion: 'pulse-warn', tone: 'warn' },
  error: { attention: 'high', statusText: 'Error', motion: 'glitch', tone: 'err' },
  offline: { attention: 'zero', statusText: 'Offline', motion: 'static', tone: 'off' },
};

/** Map LangGraph node names → Milly presence (conversation / agent stream). */
export function millyStateForAgentNode(node: string): MillyPresenceState {
  switch (node) {
    case 'planner':
      return 'planning';
    case 'retrieval':
      return 'searching';
    case 'reasoning':
      return 'writing';
    case 'reflection':
    case 'trust':
      return 'reviewing';
    case 'healing':
      return 'warning';
    default:
      return 'thinking';
  }
}

function emptyAwareness(): MillyAwareness {
  return {
    conversationActive: false,
    workspaceName: null,
    workspacePath: null,
    sessionId: null,
    providerId: null,
    providerName: null,
    providerStatus: null,
    model: null,
    pipelineState: 'IDLE',
    activeTaskLabel: null,
    memoryHits: 0,
    memoryReachable: null,
    agentStatus: 'idle',
    kernelOnline: false,
  };
}

function readAwareness(): MillyAwareness {
  const kernel = kernelStore.getSnapshot();
  const execution = executionStore.getSnapshot();
  const workspace = workspaceStore.getSnapshot();
  const memory = memoryStore.getSnapshot();
  const agent = agentStore.getSnapshot();
  const providers = providerStore.getSnapshot();
  const settings = settingsStore.getSnapshot();

  const activeId = providers.activeProviderId;
  const active = activeId ? providers.providers[activeId] : null;
  const activeTask = execution.activeTaskId
    ? execution.tasks[execution.activeTaskId]
    : null;

  return {
    conversationActive: agent.status === 'invoking',
    workspaceName: workspace.activeProject?.name ?? null,
    workspacePath: workspace.activeProject?.path ?? null,
    sessionId: workspace.activeSessionId,
    providerId: activeId,
    providerName: active?.name ?? null,
    providerStatus: active?.status ?? null,
    model: settings.providers.preferredModel || active?.models?.[0] || null,
    pipelineState: String(execution.pipelineState),
    activeTaskLabel: activeTask?.label ?? null,
    memoryHits: memory.lastResults.length,
    memoryReachable: memory.backendReachable,
    agentStatus: agent.status,
    kernelOnline: kernel.isOnline,
  };
}

class MillyStore extends Store<MillyState> {
  constructor() {
    super({
      activeState: 'idle',
      previousState: null,
      attentionLevel: 'zero',
      message: MILLY_STATE_SPECS.idle.statusText,
      generation: 0,
      awareness: emptyAwareness(),
      activeNode: null,
      transitionStartedAt: new Date().toISOString(),
    });
  }

  public applyPresence(
    activeState: MillyPresenceState,
    opts: {
      attention?: MillyAttention;
      message?: string | null;
      activeNode?: string | null;
      awareness?: MillyAwareness;
    } = {},
  ): void {
    const current = this.getSnapshot();
    if (
      current.activeState === activeState &&
      (opts.message === undefined || opts.message === current.message) &&
      (opts.activeNode === undefined || opts.activeNode === current.activeNode)
    ) {
      // Still refresh awareness silently when only context changed.
      if (opts.awareness) {
        this.updateState({ awareness: opts.awareness });
      }
      return;
    }

    const spec = MILLY_STATE_SPECS[activeState];
    this.updateState({
      previousState: current.activeState,
      activeState,
      attentionLevel: opts.attention ?? spec.attention,
      message: opts.message === undefined ? spec.statusText : opts.message,
      generation: current.generation + 1,
      awareness: opts.awareness ?? current.awareness,
      activeNode: opts.activeNode === undefined ? current.activeNode : opts.activeNode,
      transitionStartedAt: new Date().toISOString(),
    });
  }

  public setAwareness(awareness: MillyAwareness): void {
    this.updateState({ awareness });
  }
}

export const millyStore = new MillyStore();

// --- MillyEngine ---

type OverrideKind = 'cognitive' | 'voice' | 'listening' | 'success';

interface PresenceOverride {
  kind: OverrideKind;
  state: MillyPresenceState;
  message: string | null;
  node: string | null;
}

class MillyEngine {
  private isListening = false;
  /** Explicit overrides from Conversation / Voice — cleared by events, not timers. */
  private override: PresenceOverride | null = null;
  private successPendingAck = false;

  public startSync(): void {
    if (this.isListening) return;
    executionStore.subscribe(() => this.synchronize());
    kernelStore.subscribe(() => this.synchronize());
    notificationStore.subscribe(() => this.synchronize());
    agentStore.subscribe(() => this.synchronize());
    workspaceStore.subscribe(() => this.synchronize());
    memoryStore.subscribe(() => this.synchronize());
    providerStore.subscribe(() => this.synchronize());
    settingsStore.subscribe(() => this.synchronize());
    this.isListening = true;
    this.synchronize();
  }

  /** Conversation / agent node started — event-driven cognitive phase. */
  public signalAgentNode(node: string, message?: string): void {
    const state = millyStateForAgentNode(node);
    this.override = {
      kind: 'cognitive',
      state,
      message: message ?? MILLY_STATE_SPECS[state].statusText,
      node,
    };
    this.successPendingAck = false;
    this.synchronize();
  }

  /** Explicit cognitive phase (memory search, writing, coding, …). */
  public signalPhase(
    state: MillyPresenceState,
    message?: string,
    node: string | null = null,
  ): void {
    this.override = {
      kind: 'cognitive',
      state,
      message: message ?? MILLY_STATE_SPECS[state].statusText,
      node,
    };
    if (state !== 'success') this.successPendingAck = false;
    this.synchronize();
  }

  public signalListening(active: boolean): void {
    if (active) {
      this.override = {
        kind: 'listening',
        state: 'listening',
        message: MILLY_STATE_SPECS.listening.statusText,
        node: null,
      };
    } else if (this.override?.kind === 'listening') {
      this.override = null;
    }
    this.synchronize();
  }

  public signalSpeaking(active: boolean, message?: string): void {
    if (active) {
      this.override = {
        kind: 'voice',
        state: 'speaking',
        message: message ?? MILLY_STATE_SPECS.speaking.statusText,
        node: null,
      };
    } else if (this.override?.kind === 'voice') {
      this.override = null;
    }
    this.synchronize();
  }

  public signalSuccess(message?: string): void {
    this.override = {
      kind: 'success',
      state: 'success',
      message: message ?? MILLY_STATE_SPECS.success.statusText,
      node: null,
    };
    this.successPendingAck = true;
    this.synchronize();
  }

  /** Called by MillyRenderer when the success burst animation completes. */
  public acknowledgeSuccessAnimation(): void {
    if (!this.successPendingAck) return;
    this.successPendingAck = false;
    if (this.override?.kind === 'success') this.override = null;
    this.synchronize();
  }

  public clearOverride(): void {
    this.override = null;
    this.successPendingAck = false;
    this.synchronize();
  }

  public synchronize(): void {
    const awareness = readAwareness();
    const kState = kernelStore.getSnapshot();
    const eState = executionStore.getSnapshot();
    const nState = notificationStore.getSnapshot();
    const millySettings = settingsStore.getSnapshot().milly;

    // Animations disabled → still update state/message, renderer respects reduced motion.
    void millySettings;

    // Highest priority: explicit overrides (conversation / voice).
    if (this.override) {
      // Drop stale cognitive override once pipeline is idle and agent finished.
      if (
        this.override.kind === 'cognitive' &&
        eState.pipelineState === 'IDLE' &&
        agentStore.getSnapshot().status !== 'invoking'
      ) {
        this.override = null;
      } else if (this.override.kind === 'success' && !this.successPendingAck) {
        this.override = null;
      } else {
        millyStore.applyPresence(this.override.state, {
          message: this.override.message,
          activeNode: this.override.node,
          awareness,
        });
        return;
      }
    }

    // Critical failures
    if (eState.pipelineState === 'FAILED' || agentStore.getSnapshot().status === 'failed') {
      const err =
        agentStore.getSnapshot().error ||
        'Execution encountered an unrecoverable failure.';
      millyStore.applyPresence('error', { message: err, awareness, activeNode: null });
      return;
    }

    // Validation / actionable warnings
    const validation = nState.notifications.find((n) => n.type === 'validation' && !n.read);
    if (validation) {
      millyStore.applyPresence('warning', {
        message: validation.message,
        awareness,
        activeNode: null,
      });
      return;
    }

    const warning = nState.notifications.find((n) => n.type === 'warning' && !n.read);
    if (warning && eState.pipelineState === 'IDLE') {
      millyStore.applyPresence('warning', {
        message: warning.message,
        awareness,
        activeNode: null,
      });
      return;
    }

    // Offline
    if (!kState.isOnline) {
      millyStore.applyPresence('offline', {
        message: 'Connecting to PRISM Kernel…',
        awareness,
        activeNode: null,
      });
      return;
    }

    // Execution pipeline mapping
    switch (eState.pipelineState) {
      case 'PENDING':
        millyStore.applyPresence('thinking', {
          message: 'Parsing goal intent…',
          awareness,
        });
        return;
      case 'QUEUED':
        millyStore.applyPresence('planning', {
          message: 'Decomposing task dependencies…',
          awareness,
        });
        return;
      case 'RUNNING':
      case 'RETRYING': {
        const task = eState.activeTaskId ? eState.tasks[eState.activeTaskId] : null;
        const tool = task?.tool ?? '';
        if (tool === 'memory' || tool === 'memoryManager') {
          millyStore.applyPresence('searching', {
            message: task?.label ?? 'Searching memory…',
            awareness,
          });
        } else if (tool === 'router') {
          millyStore.applyPresence('thinking', {
            message: 'Evaluating routing paths…',
            awareness,
          });
        } else if (/code|edit|patch/i.test(tool) || /code/i.test(task?.label ?? '')) {
          millyStore.applyPresence('coding', {
            message: task?.label ?? 'Coding…',
            awareness,
          });
        } else if (agentStore.getSnapshot().status === 'invoking') {
          millyStore.applyPresence('writing', {
            message: task?.label ?? 'Working…',
            awareness,
          });
        } else {
          millyStore.applyPresence('executing', {
            message: task?.label ? `Executing: ${task.label}` : 'Executing active pipeline',
            awareness,
          });
        }
        return;
      }
      case 'PAUSED':
        millyStore.applyPresence('waiting', {
          message: 'Pipeline suspended',
          awareness,
        });
        return;
      case 'SUCCEEDED':
      case 'COMPLETED':
        // Success presence comes from signalSuccess(). Do not re-stick forever
        // after the renderer acknowledges the burst.
        if (this.successPendingAck) {
          millyStore.applyPresence('success', {
            message: 'Goal accomplished',
            awareness,
          });
          return;
        }
        millyStore.applyPresence('idle', {
          message: MILLY_STATE_SPECS.idle.statusText,
          awareness,
          activeNode: null,
        });
        return;
      case 'IDLE':
      case 'CANCELLED':
      default:
        millyStore.applyPresence('idle', {
          message: MILLY_STATE_SPECS.idle.statusText,
          awareness,
          activeNode: null,
        });
    }
  }
}

export const millyEngine = new MillyEngine();
export default millyEngine;

export function useMilly(): MillyState {
  return useSyncExternalStore(
    millyStore.subscribe.bind(millyStore),
    millyStore.getSnapshot.bind(millyStore),
  );
}
