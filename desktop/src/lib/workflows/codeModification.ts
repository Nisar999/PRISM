/**
 * Beta Milestone 4 — Capability 2: Code Modification Engine
 *
 * Sequences existing managers only. Patches are reviewable before any disk write.
 * No new managers / no backend redesign.
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
import {
  generateUnifiedDiff,
  joinProjectPath,
  parseAgentEditProposals,
  type FilePatch,
} from '../patch';
import {
  codeReviewStore,
  type CodeReviewProposal,
} from '../codeReviewStore';
import type { ConversationTurn } from './conversation';

export interface CodeModificationResult {
  sessionId: string;
  proposalId: string;
  source: 'agent';
  fileCount: number;
  response: AgentInvokeResponse | null;
  turns: ConversationTurn[];
  awaitingReview: boolean;
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
    data: { workflow: 'code_modification' },
    ...partial,
  };
  executionStore.handleRuntimeEvent(`runtime.${event.event_type}`, event);
  graphEngine.handleRuntimeEvent(event);
}

async function runStep(
  sessionId: string,
  taskId: string,
  label: string,
  toolId: string,
  fn: () => Promise<void>,
): Promise<void> {
  emit(sessionId, {
    event_type: 'task_started',
    message: label,
    task_id: taskId,
    tool_id: toolId,
    state_to: 'RUNNING',
  });
  try {
    await fn();
    emit(sessionId, {
      event_type: 'task_succeeded',
      message: `${label} · ok`,
      task_id: taskId,
      tool_id: toolId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(sessionId, {
      event_type: 'task_failed',
      message: `${label} · ${msg}`,
      task_id: taskId,
      tool_id: toolId,
      state_to: 'FAILED',
    });
    throw err;
  }
}

function assembleEditPrompt(opts: {
  message: string;
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
          .map((r) => `- [${r.relevance_score.toFixed(2)}] ${r.memory.content.slice(0, 220)}`)
          .join('\n');

  return [
    'PRISM Code Modification Engine — propose file edits for user review.',
    'CRITICAL: Do NOT assume files are written. Desktop applies only after Accept.',
    `Workspace project: ${project?.name ?? 'none'} (${project?.path ?? 'n/a'})`,
    `Workspace session: ${sessionId ?? 'none'}`,
    `Active provider: ${activeProvider?.name ?? providers.activeProviderId ?? 'default'}`,
    '',
    'Retrieved memory:',
    memoryBlock,
    '',
    'Output format (required for structured apply):',
    '1) Short plan in plain text.',
    '2) For each file, emit ONE of:',
    '   - A fenced block starting with: ```text path/to/file.ext',
    '     followed by the FULL proposed file contents',
    '   - Or: FILE: path/to/file.ext then a fenced full-file body',
    '   - Or a unified diff fence (```diff) with --- a/path +++ b/path',
    'Prefer small, reviewable changes. Paths are relative to the project root.',
    '',
    `User modification request: ${opts.message}`,
  ].join('\n');
}

async function buildFilePatches(
  candidates: { relativePath: string; proposed: string }[],
  projectPath: string,
): Promise<FilePatch[]> {
  const files: FilePatch[] = [];
  for (const c of candidates) {
    let original = '';
    let isNew = false;
    try {
      original = await workspaceManager.readProjectFile(c.relativePath);
    } catch {
      original = '';
      isNew = true;
    }
    if (original === c.proposed) continue;
    const { diff, additions, deletions } = generateUnifiedDiff(
      c.relativePath,
      original,
      c.proposed,
    );
    files.push({
      path: joinProjectPath(projectPath, c.relativePath),
      relativePath: c.relativePath,
      original,
      proposed: c.proposed,
      unifiedDiff: diff,
      additions,
      deletions,
      status: 'pending',
      isNew,
    });
  }
  return files;
}

/**
 * Plan + propose patches. Never writes project source files.
 */
export async function runCodeModification(
  userMessage: string,
  priorTurns: ConversationTurn[] = [],
): Promise<CodeModificationResult> {
  const message = userMessage.trim();
  if (!message) throw new Error('Empty message');

  const project = workspaceStore.getSnapshot().activeProject;
  if (!project) {
    throw new Error('Open a workspace before requesting code modifications.');
  }

  let sessionId = workspaceStore.getSnapshot().activeSessionId;
  if (!sessionId) {
    const session = await workspaceManager.createSession(project.id, 'Code modification session');
    sessionId = session.id;
  }

  const workflowSessionId = sessionId;

  executionStore.resetSession(workflowSessionId);
  emit(workflowSessionId, {
    event_type: 'session_created',
    message: 'Code modification workflow',
    state_to: 'PENDING',
  });
  emit(workflowSessionId, {
    event_type: 'session_started',
    message: 'Planning edits',
    state_to: 'RUNNING',
  });
  executionStore.applyLocalPipelineState('RUNNING', workflowSessionId);

  millyEngine.signalPhase('coding', 'Planning code changes…');
  shellUiStore.setBottomTab('graph');
  shellUiStore.setRightTab('memory');

  const userTurn: ConversationTurn = {
    id: crypto.randomUUID(),
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
    intent: 'code_mod',
  };

  let memoryHits: MemorySearchResult[] = [];
  const agentBox: { response: AgentInvokeResponse | null } = { response: null };
  let proposal!: CodeReviewProposal;
  let source: 'agent' = 'agent';

  try {
    await runStep(workflowSessionId, 'mod.intent', 'Intent · code_mod', 'conversation', async () => {});

    await runStep(
      workflowSessionId,
      'mod.memory',
      'Memory retrieval',
      'memoryManager',
      async () => {
        try {
          memoryHits = await memoryManager.search({ query: message, limit: 8 });
        } catch {
          memoryHits = [];
        }
      },
    );

    let assembled = '';
    await runStep(
      workflowSessionId,
      'mod.context',
      'Workspace context',
      'workspaceManager',
      async () => {
        assembled = assembleEditPrompt({ message, memoryHits });
      },
    );

    await runStep(
      workflowSessionId,
      'mod.planner',
      'Planner / agent propose',
      'agentManager',
      async () => {
        try {
          agentBox.response = await agentManager.invoke(
            { message: assembled, session_id: workflowSessionId },
            { resetExecution: false },
          );
        } catch {
          agentBox.response = null;
        }
        shellUiStore.setRightTab('thoughts');
      },
    );

    await runStep(
      workflowSessionId,
      'mod.diff',
      'Unified diff generation',
      'workspaceAdapter',
      async () => {
        const blob = [
          agentBox.response?.final_answer,
          agentBox.response?.plan,
          agentBox.response?.reasoning,
        ]
          .filter(Boolean)
          .join('\n\n');

        let candidates: { relativePath: string; proposed: string }[] = parseAgentEditProposals(
          blob,
        ).map(({ relativePath, proposed }) => ({ relativePath, proposed }));
        let planSummary =
          agentBox.response?.plan ||
          agentBox.response?.final_answer?.slice(0, 400) ||
          'Agent proposal';

        if (candidates.length === 0) {
          // No parseable edits from the agent — surface an honest empty
          // proposal instead of fabricating a demo file edit. The review UI
          // shows the agent's reasoning so the user can iterate.
          source = 'agent';
        }

        const files = await buildFilePatches(candidates, project.path);
        if (files.length === 0 && candidates.length > 0) {
          // Agent proposed identical content (no diff). Keep the proposal but
          // leave files empty so the review UI shows "no changes".
        }

        proposal = {
          id: `prop_${crypto.randomUUID().slice(0, 8)}`,
          sessionId: workflowSessionId,
          createdAt: new Date().toISOString(),
          userMessage: message,
          planSummary,
          source,
          files,
          decision: files.length === 0 ? 'rejected' : 'pending',
        };
        codeReviewStore.setProposal(proposal);

        try {
          await workspaceManager.upsertArtifact(project.id, {
            id: `diff_${proposal.id}`,
            session_id: workflowSessionId,
            name: `Diff proposal ${proposal.id}`,
            type: 'diff',
            content: JSON.stringify(
              {
                proposalId: proposal.id,
                source,
                planSummary,
                files: files.map((f) => ({
                  path: f.relativePath,
                  additions: f.additions,
                  deletions: f.deletions,
                  unifiedDiff: f.unifiedDiff,
                  isNew: f.isNew,
                })),
              },
              null,
              2,
            ),
          });
        } catch {
          // soft-fail artifact
        }
      },
    );

    await runStep(
      workflowSessionId,
      'mod.review',
      'Awaiting user review',
      'codeReview',
      async () => {
        shellUiStore.setBottomTab('review');
        millyEngine.signalPhase('reviewing', 'Review proposed edits before apply');
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(workflowSessionId, {
      event_type: 'session_failed',
      message: msg,
      state_to: 'FAILED',
    });
    executionStore.applyLocalPipelineState('FAILED', workflowSessionId);
    millyEngine.signalPhase('error', 'Code modification failed');
    throw err;
  }

  const totals = proposal.files.reduce(
    (acc, f) => {
      acc.add += f.additions;
      acc.del += f.deletions;
      return acc;
    },
    { add: 0, del: 0 },
  );

  const prismTurn: ConversationTurn = {
    id: crypto.randomUUID(),
    role: 'prism',
    content: [
      `Proposed ${proposal.files.length} file change(s) (+${totals.add}/-${totals.del}) via ${source}.`,
      planLine(proposal.planSummary),
      'Open Code Review to Accept or Reject. Nothing is written until you approve.',
    ].join('\n\n'),
    timestamp: new Date().toISOString(),
    intent: 'code_mod',
    memoryHits: memoryHits.length,
    plan: proposal.planSummary,
    reasoning: agentBox.response?.reasoning,
    trustScore: agentBox.response?.trust_score,
  };

  emit(workflowSessionId, {
    event_type: 'session_completed',
    message: 'Proposal ready for review',
    state_to: 'PAUSED',
  });
  executionStore.applyLocalPipelineState('PAUSED', workflowSessionId);

  notificationStore.addNotification({
    type: 'info',
    message: 'Code Review Ready',
    description: `${proposal.files.length} file(s) · ${source} · awaiting Accept / Reject`,
  });

  return {
    sessionId: workflowSessionId,
    proposalId: proposal.id,
    source,
    fileCount: proposal.files.length,
    response: agentBox.response,
    turns: [...priorTurns, userTurn, prismTurn],
    awaitingReview: true,
  };
}

function planLine(summary: string): string {
  const s = summary.trim();
  return s.length > 500 ? `${s.slice(0, 500)}…` : s;
}

/**
 * Apply accepted files only. Snapshots originals for rollback.
 * With onlyPaths: apply those files and keep remaining pending files in review.
 */
export async function acceptCodeModifications(opts?: {
  proposalId?: string;
  /** If set, only these relative paths */
  onlyPaths?: string[];
}): Promise<{ applied: string[]; rolledBack: boolean }> {
  const active = codeReviewStore.getSnapshot().activeProposal;
  if (!active) throw new Error('No pending proposal.');
  if (opts?.proposalId && active.id !== opts.proposalId) {
    throw new Error('Proposal id mismatch.');
  }

  const project = workspaceStore.getSnapshot().activeProject;
  if (!project) throw new Error('No active project.');

  const sessionId = active.sessionId;
  const toApply = active.files.filter((f) => {
    if (opts?.onlyPaths?.length) {
      return opts.onlyPaths.includes(f.relativePath) && f.status !== 'rejected';
    }
    return f.status === 'accepted' || f.status === 'pending';
  });

  if (toApply.length === 0) {
    throw new Error('No files selected to apply.');
  }

  if (!opts?.onlyPaths) {
    codeReviewStore.acceptAllPending();
  } else {
    for (const p of opts.onlyPaths) codeReviewStore.acceptFile(p);
  }

  const snapshots: Record<string, string> = {
    ...(active.appliedSnapshots ?? {}),
  };
  const applied: string[] = [];

  emit(sessionId, {
    event_type: 'task_started',
    message: 'Applying approved patches',
    task_id: 'mod.apply',
    tool_id: 'workspaceManager',
    state_to: 'RUNNING',
  });
  executionStore.applyLocalPipelineState('RUNNING', sessionId);
  millyEngine.signalPhase('executing', 'Applying approved edits…');

  try {
    for (const file of toApply) {
      snapshots[file.path] = file.original;
      await workspaceManager.writeProjectFile(file.relativePath, file.proposed);
      applied.push(file.relativePath);
    }

    emit(sessionId, {
      event_type: 'task_succeeded',
      message: `Applied ${applied.length} file(s)`,
      task_id: 'mod.apply',
      tool_id: 'workspaceManager',
    });

    const refreshed = codeReviewStore.getSnapshot().activeProposal;

    // Mark applied files accepted
    if (refreshed) {
      const files = refreshed.files.map((f) =>
        applied.includes(f.relativePath) ? { ...f, status: 'accepted' as const } : f,
      );
      codeReviewStore.updateFiles(files);
    }

    const stillPending =
      codeReviewStore
        .getSnapshot()
        .activeProposal?.files.filter((f) => f.status === 'pending') ?? [];

    if (stillPending.length === 0) {
      await persistOutcome(sessionId, active, 'accepted', [
        ...applied,
        ...(active.files.filter((f) => f.status === 'accepted').map((f) => f.relativePath)),
      ].filter((v, i, a) => a.indexOf(v) === i));

      codeReviewStore.complete('accepted', snapshots);
      shellUiStore.setBottomTab('graph');
      millyEngine.signalSuccess('Edits applied');
      executionStore.applyLocalPipelineState('SUCCEEDED', sessionId);
      emit(sessionId, {
        event_type: 'session_completed',
        message: 'Code modification accepted',
        state_to: 'SUCCEEDED',
      });
    } else {
      // Keep proposal open with snapshots accumulated
      const cur = codeReviewStore.getSnapshot().activeProposal;
      if (cur) {
        codeReviewStore.setProposal({ ...cur, appliedSnapshots: snapshots });
      }
      millyEngine.signalPhase('waiting', `${stillPending.length} file(s) still pending`);
      executionStore.applyLocalPipelineState('PAUSED', sessionId);
    }

    notificationStore.addNotification({
      type: 'success',
      message: 'Changes Applied',
      description: applied.join(', ') || 'No files',
    });

    return { applied, rolledBack: false };
  } catch (err) {
    for (const [abs, content] of Object.entries(snapshots)) {
      if (!applied.some((rel) => joinProjectPath(project.path, rel) === abs.replace(/\\/g, '/'))) {
        continue;
      }
      const root = project.path.replace(/\\/g, '/');
      const norm = abs.replace(/\\/g, '/');
      const rel = norm.startsWith(root) ? norm.slice(root.length).replace(/^\//, '') : null;
      if (rel != null) {
        try {
          await workspaceManager.writeProjectFile(rel, content);
        } catch {
          // continue rollback
        }
      }
    }
    emit(sessionId, {
      event_type: 'task_failed',
      message: err instanceof Error ? err.message : String(err),
      task_id: 'mod.apply',
      tool_id: 'workspaceManager',
      state_to: 'FAILED',
    });
    executionStore.applyLocalPipelineState('FAILED', sessionId);
    millyEngine.signalPhase('error', 'Apply failed — rolled back');
    throw err;
  }
}

export async function rejectCodeModifications(opts?: {
  proposalId?: string;
}): Promise<void> {
  const active = codeReviewStore.getSnapshot().activeProposal;
  if (!active) throw new Error('No pending proposal.');
  if (opts?.proposalId && active.id !== opts.proposalId) {
    throw new Error('Proposal id mismatch.');
  }

  codeReviewStore.rejectAllPending();
  await persistOutcome(active.sessionId, active, 'rejected', []);
  codeReviewStore.complete('rejected');

  emit(active.sessionId, {
    event_type: 'session_completed',
    message: 'Code modification rejected',
    state_to: 'CANCELLED',
  });
  executionStore.applyLocalPipelineState('CANCELLED', active.sessionId);
  millyEngine.clearOverride();
  millyEngine.signalPhase('idle', 'Edits rejected');
  shellUiStore.setBottomTab('graph');

  notificationStore.addNotification({
    type: 'warning',
    message: 'Changes Rejected',
    description: 'No files were written.',
  });
}

/**
 * Restore last applied proposal from snapshots (undo).
 */
export async function rollbackLastCodeModification(): Promise<string[]> {
  const last = codeReviewStore.getSnapshot().lastProposal;
  if (!last?.appliedSnapshots || last.decision !== 'accepted') {
    throw new Error('Nothing to roll back.');
  }
  const project = workspaceStore.getSnapshot().activeProject;
  if (!project) throw new Error('No active project.');

  const restored: string[] = [];
  const root = project.path.replace(/\\/g, '/');
  for (const [abs, content] of Object.entries(last.appliedSnapshots)) {
    const norm = abs.replace(/\\/g, '/');
    const rel = norm.startsWith(root) ? norm.slice(root.length).replace(/^\//, '') : null;
    if (!rel) continue;
    await workspaceManager.writeProjectFile(rel, content);
    restored.push(rel);
  }

  codeReviewStore.markLastRolledBack();
  await persistOutcome(last.sessionId, last, 'rolled_back', restored);

  emit(last.sessionId, {
    event_type: 'session_completed',
    message: 'Code modification rolled back',
    state_to: 'CANCELLED',
  });

  notificationStore.addNotification({
    type: 'info',
    message: 'Rollback Complete',
    description: restored.join(', '),
  });

  return restored;
}

async function persistOutcome(
  sessionId: string,
  proposal: CodeReviewProposal,
  decision: 'accepted' | 'rejected' | 'rolled_back',
  paths: string[],
): Promise<void> {
  try {
    await memoryManager.create({
      content: `Code modification ${decision}: ${proposal.userMessage.slice(0, 200)} → ${paths.join(', ') || '(none)'} [${proposal.source}]`,
      session_id: sessionId,
      memory_type: 'episodic',
      metadata: {
        workflow: 'code_modification',
        decision,
        proposal_id: proposal.id,
        files: paths,
        source: proposal.source,
      },
    });
  } catch {
    // soft-fail
  }

  const project = workspaceStore.getSnapshot().activeProject;
  if (!project) return;
  try {
    await workspaceManager.upsertArtifact(project.id, {
      id: `diff_outcome_${proposal.id}`,
      session_id: sessionId,
      name: `Diff outcome ${decision}`,
      type: 'diff',
      content: JSON.stringify(
        {
          proposalId: proposal.id,
          decision,
          paths,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    });
  } catch {
    // soft-fail
  }
}
