/**
 * Beta Milestone 3 — Capability 1: Conversation Engine
 *
 * Sequences existing managers only. No new managers / no backend redesign.
 * Backend owns intelligence; desktop renders; history belongs to workspace/session.
 */

import type { AgentInvokeResponse, ExecutionEvent, MemorySearchResult } from '../api';
import { memoryManager } from '../memory';
import { agentManager } from '../agent';
import { workspaceManager } from '../workspace';
import { providerStore } from '../providers';
import { executionStore, notificationStore, workspaceStore } from '../store';
import { graphEngine } from '../graph';
import { shellUiStore } from '../shellUi';
import { millyEngine } from '../milly';
import { settingsStore } from '../settings';
import { voiceManager } from '../voice';
import { runCodeModification } from './codeModification';

export type ConversationIntent =
  | 'question'
  | 'memory'
  | 'planning'
  | 'execution'
  | 'workspace'
  | 'code_mod'
  | 'general';

export interface ConversationTurn {
  id: string;
  role: 'user' | 'prism';
  content: string;
  timestamp: string;
  intent?: ConversationIntent;
  memoryHits?: number;
  plan?: string | null;
  reasoning?: string | null;
  reflection?: string | null;
  trustScore?: number;
  error?: string;
}

export interface ConversationResult {
  sessionId: string;
  intent: ConversationIntent;
  memoryHits: number;
  response: AgentInvokeResponse | null;
  turns: ConversationTurn[];
}

const HISTORY_PREFIX = 'conversation_';

/** Lightweight desktop intent routing — not a parallel intelligence system. */
export function detectIntent(message: string): ConversationIntent {
  const m = message.toLowerCase().trim();
  if (
    /\b(edit|modify|refactor|patch|fix|change the (code|file)|update the file|write (to )?file|apply (a )?change)\b/.test(
      m,
    )
  ) {
    return 'code_mod';
  }
  if (/\b(remember|recall|memory|what did we|past context)\b/.test(m)) return 'memory';
  if (/\b(plan|steps|how should|roadmap|strategy)\b/.test(m)) return 'planning';
  if (/\b(run|execute|graph|pipeline|status of execution)\b/.test(m)) return 'execution';
  if (/\b(file|folder|workspace|project|open editor)\b/.test(m)) return 'workspace';
  if (/\?|^(what|why|how|when|where|who|explain|describe|summarize)\b/.test(m)) return 'question';
  return 'general';
}

function emit(
  sessionId: string,
  partial: Partial<ExecutionEvent> & Pick<ExecutionEvent, 'event_type' | 'message'>,
): void {
  const event: ExecutionEvent = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    task_id: null,
    tool_id: null,
    data: { workflow: 'conversation' },
    ...partial,
  };
  executionStore.handleRuntimeEvent(`runtime.${event.event_type}`, event);
  graphEngine.handleRuntimeEvent(event);
}

async function runStep(
  sessionId: string,
  taskId: string,
  label: string,
  tool: string,
  fn: () => Promise<void>,
): Promise<void> {
  emit(sessionId, {
    event_type: 'task_started',
    task_id: taskId,
    tool_id: tool,
    message: label,
  });
  try {
    await fn();
    emit(sessionId, {
      event_type: 'task_succeeded',
      task_id: taskId,
      tool_id: tool,
      message: `${label} · done`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit(sessionId, {
      event_type: 'task_failed',
      task_id: taskId,
      tool_id: tool,
      message: `${label} · ${message}`,
    });
    throw err;
  }
}

function artifactIdForSession(sessionId: string): string {
  return `${HISTORY_PREFIX}${sessionId}`;
}

export async function loadConversationHistory(): Promise<ConversationTurn[]> {
  const project = workspaceStore.getSnapshot().activeProject;
  const sessionId = workspaceStore.getSnapshot().activeSessionId;
  if (!project || !sessionId) return [];
  try {
    const art = await workspaceManager.loadArtifact(project.id, artifactIdForSession(sessionId));
    const parsed = JSON.parse(art.content) as { turns?: ConversationTurn[] };
    return Array.isArray(parsed.turns) ? parsed.turns : [];
  } catch {
    return [];
  }
}

async function saveConversationHistory(
  sessionId: string,
  turns: ConversationTurn[],
): Promise<void> {
  const project = workspaceStore.getSnapshot().activeProject;
  if (!project) return;
  await workspaceManager.upsertArtifact(project.id, {
    id: artifactIdForSession(sessionId),
    session_id: sessionId,
    name: 'Conversation History',
    type: 'conversation',
    content: JSON.stringify({ turns, updated_at: new Date().toISOString() }, null, 2),
  });
}

function assembleContext(opts: {
  message: string;
  intent: ConversationIntent;
  memoryHits: MemorySearchResult[];
}): string {
  const project = workspaceStore.getSnapshot().activeProject;
  const sessionId = workspaceStore.getSnapshot().activeSessionId;
  const providers = providerStore.getSnapshot();
  const activeProvider = providers.activeProviderId
    ? providers.providers[providers.activeProviderId]
    : null;

  const memoryBlock =
    opts.memoryHits.length === 0
      ? '(no memory hits)'
      : opts.memoryHits
          .slice(0, 6)
          .map(
            (r) =>
              `- [${r.relevance_score.toFixed(2)}] ${r.memory.content.slice(0, 220)}`,
          )
          .join('\n');

  return [
    'PRISM Conversation Engine — orchestrate reasoning for the user.',
    `Intent (desktop routing): ${opts.intent}`,
    `Workspace project: ${project?.name ?? 'none'} (${project?.path ?? 'n/a'})`,
    `Workspace session: ${sessionId ?? 'none'}`,
    `Active provider: ${activeProvider?.name ?? providers.activeProviderId ?? 'default'}`,
    '',
    'Retrieved memory:',
    memoryBlock,
    '',
    'Instructions:',
    '- Reason before answering.',
    '- Produce a clear plan when useful.',
    '- Reflect briefly on confidence / gaps.',
    '- Prefer durable, workspace-aware guidance over chatty filler.',
    '',
    `User message: ${opts.message}`,
  ].join('\n');
}

/**
 * Run one conversational turn through the existing intelligence stack.
 * Code-modification intents delegate to the Code Modification Engine (still no new managers).
 */
export async function runConversationTurn(
  userMessage: string,
  priorTurns: ConversationTurn[] = [],
): Promise<ConversationResult> {
  return runConversationTurnWith(userMessage, priorTurns, {});
}

export interface ConversationStreamHandlers {
  /** Called once with the user's turn (immediately after submission). */
  onUserTurn?: (turn: ConversationTurn) => void;
  /** Called when the PRISM turn placeholder is created (before streaming begins). */
  onPrismStart?: (turn: ConversationTurn) => void;
  /** Called whenever the PRISM turn content is updated incrementally. */
  onPrismUpdate?: (turn: ConversationTurn) => void;
  /** Called when the PRISM turn is finalized (after streaming completes). */
  onPrismFinal?: (turn: ConversationTurn) => void;
  /** AbortSignal for cancel — wired to agent stream. */
  signal?: AbortSignal;
}

/**
 * Streaming variant: invokes the agent graph via SSE and emits incremental
 * PRISM turn updates as each node publishes state. Conversation persistence
 * remains real (history is saved on completion).
 */
export async function runConversationTurnStream(
  userMessage: string,
  priorTurns: ConversationTurn[] = [],
  handlers: ConversationStreamHandlers = {},
): Promise<ConversationResult> {
  return runConversationTurnWith(userMessage, priorTurns, { stream: true, handlers });
}

async function runConversationTurnWith(
  userMessage: string,
  priorTurns: ConversationTurn[] = [],
  opts: { stream?: boolean; handlers?: ConversationStreamHandlers } = {},
): Promise<ConversationResult> {
  const message = userMessage.trim();
  if (!message) {
    throw new Error('Empty message');
  }

  const { stream = false, handlers = {} } = opts;
  const intent = detectIntent(message);
  if (intent === 'code_mod') {
    const mod = await runCodeModification(message, priorTurns);
    try {
      await saveConversationHistory(mod.sessionId, mod.turns);
    } catch {
      // local history still returned
    }
    return {
      sessionId: mod.sessionId,
      intent: 'code_mod',
      memoryHits: 0,
      response: mod.response,
      turns: mod.turns,
    };
  }

  const project = workspaceStore.getSnapshot().activeProject;
  let sessionId = workspaceStore.getSnapshot().activeSessionId;

  if (project && !sessionId) {
    const session = await workspaceManager.createSession(
      project.id,
      'Conversation session',
    );
    sessionId = session.id;
  }

  const workflowSessionId = sessionId ?? `conv_${crypto.randomUUID().slice(0, 8)}`;

  executionStore.resetSession(workflowSessionId);
  emit(workflowSessionId, {
    event_type: 'session_created',
    message: 'Conversation turn',
    state_to: 'PENDING',
  });
  emit(workflowSessionId, {
    event_type: 'session_started',
    message: `Intent: ${intent}`,
    state_to: 'RUNNING',
  });
  executionStore.applyLocalPipelineState('RUNNING', workflowSessionId);

  millyEngine.signalPhase('thinking', 'Understanding your question…');
  shellUiStore.setBottomTab('graph');
  shellUiStore.setRightTab('memory');

  const userTurn: ConversationTurn = {
    id: crypto.randomUUID(),
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
    intent,
  };
  handlers.onUserTurn?.(userTurn);

  let memoryHits: MemorySearchResult[] = [];
  const agentBox: { response: AgentInvokeResponse | null } = { response: null };
  let prismTurn: ConversationTurn = {
    id: crypto.randomUUID(),
    role: 'prism',
    content: '',
    timestamp: new Date().toISOString(),
    intent,
    memoryHits: 0,
  };
  handlers.onPrismStart?.(prismTurn);

  const updatePrism = (partial: Partial<AgentInvokeResponse>) => {
    const next: ConversationTurn = {
      ...prismTurn,
      content:
        partial.final_answer ??
        partial.reasoning ??
        prismTurn.content,
      plan: partial.plan ?? prismTurn.plan,
      reasoning: partial.reasoning ?? prismTurn.reasoning,
      reflection: partial.reflection ?? prismTurn.reflection,
      trustScore: partial.trust_score ?? prismTurn.trustScore,
    };
    prismTurn = next;
    handlers.onPrismUpdate?.(next);
  };

  try {
    await runStep(
      workflowSessionId,
      'conv.intent',
      `Intent detection · ${intent}`,
      'conversation',
      async () => {
        /* intent already computed — step records graph node */
      },
    );

    await runStep(
      workflowSessionId,
      'conv.memory',
      'Memory retrieval',
      'memoryManager',
      async () => {
        millyEngine.signalPhase('searching', 'Searching memory…');
        try {
          memoryHits = await memoryManager.search({ query: message, limit: 8 });
          shellUiStore.setRightTab('memory');
        } catch {
          memoryHits = [];
        }
      },
    );

    let assembled = '';
    await runStep(
      workflowSessionId,
      'conv.context',
      'Context assembly',
      'workspaceManager',
      async () => {
        millyEngine.signalPhase('reading', 'Assembling workspace context…');
        assembled = assembleContext({ message, intent, memoryHits });
      },
    );

    await runStep(
      workflowSessionId,
      'conv.agent',
      stream ? 'Planner / agent stream' : 'Planner / agent invoke',
      'agentManager',
      async () => {
        millyEngine.signalPhase('planning', 'Connecting intelligence…');
        if (stream) {
          agentBox.response = await agentManager.invokeStream(
            {
              message: assembled,
              session_id: workflowSessionId,
            },
            {
              resetExecution: false,
              signal: handlers.signal,
              onNodeStarted: (node) => {
                millyEngine.signalAgentNode(node);
              },
              onUpdate: (partial) => updatePrism(partial),
            },
          );
        } else {
          agentBox.response = await agentManager.invoke(
            {
              message: assembled,
              session_id: workflowSessionId,
            },
            { resetExecution: false },
          );
          updatePrism(agentBox.response);
        }
        shellUiStore.setRightTab('thoughts');
      },
    );

    await runStep(
      workflowSessionId,
      'conv.persist',
      'Memory persistence',
      'memoryManager',
      async () => {
        const answer =
          agentBox.response?.final_answer || agentBox.response?.reasoning || '';
        if (!answer) return;
        try {
          await memoryManager.create({
            content: `Q: ${message}\nA: ${answer.slice(0, 2000)}`,
            session_id: workflowSessionId,
            memory_type: 'episodic',
            metadata: {
              workflow: 'conversation',
              intent,
              project_id: project?.id ?? null,
            },
          });
        } catch {
          // soft-fail persistence
        }
      },
    );

    const response = agentBox.response;
    prismTurn = {
      ...prismTurn,
      content:
        response?.final_answer ||
        response?.reasoning ||
        response?.errors?.join('; ') ||
        'No response from agent pipeline.',
      plan: response?.plan,
      reasoning: response?.reasoning,
      reflection: response?.reflection,
      trustScore: response?.trust_score,
      error: response?.errors?.length ? response.errors.join('; ') : undefined,
      memoryHits: memoryHits.length,
    };
    handlers.onPrismFinal?.(prismTurn);

    millyEngine.signalSuccess('Response ready');

    const millySettings = settingsStore.getSnapshot().milly;
    if (
      millySettings.voiceEnabled &&
      millySettings.autoSpeak &&
      prismTurn.content &&
      !prismTurn.error
    ) {
      void voiceManager.speak(prismTurn.content).catch(() => {
        /* VoiceManager already notifies on hard failures */
      });
    }
  } catch (err) {
    const aborted =
      (err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && /abort/i.test(err.message));
    if (aborted) {
      millyEngine.clearOverride();
      prismTurn = {
        ...prismTurn,
        content: prismTurn.content || 'Cancelled.',
        error: 'Cancelled',
        memoryHits: memoryHits.length,
      };
      handlers.onPrismFinal?.(prismTurn);
      emit(workflowSessionId, {
        event_type: 'session_failed',
        message: 'Cancelled',
        state_to: 'FAILED',
      });
      executionStore.applyLocalPipelineState('CANCELLED', workflowSessionId);
      throw err;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    prismTurn = {
      ...prismTurn,
      content: `Conversation failed: ${errMsg}`,
      error: errMsg,
      memoryHits: memoryHits.length,
    };
    handlers.onPrismFinal?.(prismTurn);
    millyEngine.signalPhase('error', errMsg);
    emit(workflowSessionId, {
      event_type: 'session_failed',
      message: errMsg,
      state_to: 'FAILED',
    });
    executionStore.applyLocalPipelineState('FAILED', workflowSessionId);
    throw err;
  }

  const stepIds = [
    'conv.intent',
    'conv.memory',
    'conv.context',
    'conv.agent',
    'conv.persist',
  ];
  for (let i = 0; i < stepIds.length - 1; i++) {
    graphEngine.setEdge({
      id: `e_${stepIds[i]}_${stepIds[i + 1]}_${Date.now()}`,
      source: stepIds[i],
      target: stepIds[i + 1],
      type: 'flow',
    });
  }

  emit(workflowSessionId, {
    event_type: 'session_succeeded',
    message: 'Conversation turn complete',
    state_to: 'SUCCEEDED',
  });
  executionStore.applyLocalPipelineState('SUCCEEDED', workflowSessionId);

  const turns = [...priorTurns, userTurn, prismTurn];
  if (project && sessionId) {
    try {
      await saveConversationHistory(sessionId, turns);
    } catch {
      // local render history still returned
    }
  }

  notificationStore.addNotification({
    type: prismTurn.error ? 'warning' : 'success',
    message: 'Conversation Turn Complete',
    description: `${intent} · memory ${memoryHits.length} · ${prismTurn.content.slice(0, 120)}`,
  });

  return {
    sessionId: workflowSessionId,
    intent,
    memoryHits: memoryHits.length,
    response: agentBox.response,
    turns,
  };
}
