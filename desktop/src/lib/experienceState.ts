/**
 * Experience State Engine (R4) — derived presentation layer only.
 * Reads existing router location + stores; does not own business state.
 */

import { useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { executionStore, workspaceStore, useWorkspace, useExecution } from './store';
import { agentStore, useAgent } from './agent';

export type ExperienceState =
  | 'welcome'
  | 'conversation'
  | 'workspace-active'
  | 'editing'
  | 'executing'
  | 'completed';

const EXECUTING_PIPELINE = new Set(['QUEUED', 'RUNNING', 'RETRYING', 'PAUSED', 'PENDING']);
const TERMINAL_PIPELINE = new Set(['SUCCEEDED', 'FAILED', 'COMPLETED', 'CANCELLED']);

export interface ExperienceSnapshot {
  state: ExperienceState;
  label: string;
  description: string;
}

export function experienceStateLabel(state: ExperienceState): string {
  switch (state) {
    case 'welcome':
      return 'Welcome';
    case 'conversation':
      return 'Conversation';
    case 'workspace-active':
      return 'Workspace active';
    case 'editing':
      return 'Editing';
    case 'executing':
      return 'Executing';
    case 'completed':
      return 'Completed';
    default:
      return 'Conversation';
  }
}

export function deriveExperienceState(input: {
  pathname: string;
  hasActiveProject: boolean;
  pipelineState: string;
  agentInvoking: boolean;
}): ExperienceState {
  const { pathname, hasActiveProject, pipelineState, agentInvoking } = input;

  if (pathname.startsWith('/editor')) return 'editing';

  if (EXECUTING_PIPELINE.has(pipelineState) || agentInvoking) return 'executing';

  if (TERMINAL_PIPELINE.has(pipelineState)) return 'completed';

  if (
    hasActiveProject &&
    (pathname.startsWith('/workspace') || pathname.startsWith('/conversation'))
  ) {
    return 'workspace-active';
  }

  if (pathname.startsWith('/conversation')) return 'conversation';

  if (pathname === '/' || pathname === '') return 'welcome';

  return 'conversation';
}

export function buildExperienceSnapshot(
  state: ExperienceState,
  projectName?: string | null,
): ExperienceSnapshot {
  const label = experienceStateLabel(state);
  const descriptions: Record<ExperienceState, string> = {
    welcome: 'Start a conversation or continue recent work.',
    conversation: 'Primary surface — chat drives the session.',
    'workspace-active': projectName
      ? `Project “${projectName}” is in context.`
      : 'Workspace context is attached to this session.',
    editing: 'Editor opens for code tasks only.',
    executing: 'Pipeline and tools are running.',
    completed: 'Run finished — contextual panels collapse.',
  };
  return { state, label, description: descriptions[state] };
}

export function readExperienceInputs(): {
  pathname: string;
  hasActiveProject: boolean;
  pipelineState: string;
  agentInvoking: boolean;
  projectName: string | null;
} {
  const pathname =
    typeof window !== 'undefined' ? window.location.pathname : '/';
  const ws = workspaceStore.getSnapshot();
  const ex = executionStore.getSnapshot();
  const agent = agentStore.getSnapshot();
  return {
    pathname,
    hasActiveProject: Boolean(ws.activeProject),
    pipelineState: ex.pipelineState,
    agentInvoking: agent.status === 'invoking',
    projectName: ws.activeProject?.name ?? null,
  };
}

function subscribeExperience(listener: () => void): () => void {
  const unWs = workspaceStore.subscribe(listener);
  const unEx = executionStore.subscribe(listener);
  const unAgent = agentStore.subscribe(listener);
  return () => {
    unWs();
    unEx();
    unAgent();
  };
}

function getExperienceSnapshot(): ExperienceSnapshot {
  const input = readExperienceInputs();
  const state = deriveExperienceState(input);
  const next = buildExperienceSnapshot(state, input.projectName);
  const prev = cachedExperienceSnapshot;
  if (
    prev &&
    prev.state === next.state &&
    prev.label === next.label &&
    prev.description === next.description
  ) {
    return prev;
  }
  cachedExperienceSnapshot = next;
  return next;
}

let cachedExperienceSnapshot: ExperienceSnapshot | null = null;

/** React hook — derived experience state (not a new store). */
export function useExperienceState(): ExperienceSnapshot {
  const location = useLocation();
  const workspace = useWorkspace();
  const execution = useExecution();
  const agent = useAgent();
  useSyncExternalStore(subscribeExperience, getExperienceSnapshot, getExperienceSnapshot);

  const state = deriveExperienceState({
    pathname: location.pathname,
    hasActiveProject: Boolean(workspace.activeProject),
    pipelineState: execution.pipelineState,
    agentInvoking: agent.status === 'invoking',
  });
  return buildExperienceSnapshot(state, workspace.activeProject?.name);
}

export function isExecutingPipeline(pipelineState: string): boolean {
  return EXECUTING_PIPELINE.has(pipelineState);
}

export function isTerminalPipeline(pipelineState: string): boolean {
  return TERMINAL_PIPELINE.has(pipelineState);
}
