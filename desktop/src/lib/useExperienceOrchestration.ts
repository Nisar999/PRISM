/**
 * Syncs contextual shell chrome (panels) to derived experience state.
 * Workflows may still open panels explicitly; this handles lifecycle collapse.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { shellUiStore } from './shellUi';
import { useWorkspace, useExecution } from './store';
import { useAgent } from './agent';
import {
  deriveExperienceState,
  isExecutingPipeline,
  isTerminalPipeline,
} from './experienceState';

export function useExperienceOrchestration(): void {
  const location = useLocation();
  const workspace = useWorkspace();
  const execution = useExecution();
  const agent = useAgent();
  const prevPipeline = useRef(execution.pipelineState);

  useEffect(() => {
    const input = {
      pathname: location.pathname,
      hasActiveProject: Boolean(workspace.activeProject),
      pipelineState: execution.pipelineState,
      agentInvoking: agent.status === 'invoking',
    };
    const state = deriveExperienceState(input);

    if (state === 'executing') {
      shellUiStore.setBottomTab('graph');
      if (agent.status === 'invoking') {
        shellUiStore.setRightTab('thoughts');
      }
    }
  }, [
    location.pathname,
    workspace.activeProject?.id,
    execution.pipelineState,
    agent.status,
  ]);

  useEffect(() => {
    const prev = prevPipeline.current;
    const next = execution.pipelineState;
    const wasExecuting = isExecutingPipeline(prev);
    const isTerminal = isTerminalPipeline(next);

    if (wasExecuting && isTerminal) {
      // Keep IDE chrome (agent panel) open; only drop the bottom dock after settle.
      const timer = window.setTimeout(() => {
        const snap = shellUiStore.getSnapshot();
        if (snap.bottomOpen && snap.bottomTab === 'graph') {
          shellUiStore.toggleBottom();
        }
      }, 2400);
      prevPipeline.current = next;
      return () => window.clearTimeout(timer);
    }

    prevPipeline.current = next;
  }, [execution.pipelineState]);
}
