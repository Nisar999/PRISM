/**
 * Agent manager — invokes backend LangGraph pipeline.
 * No local planner/executor; HTTP result is the source of truth for the invoke path.
 */

import { useSyncExternalStore } from 'react';
import { api, AgentInvokeRequest, AgentInvokeResponse } from './api';
import { Store, executionStore, notificationStore } from './store';

export interface AgentState {
  status: 'idle' | 'invoking' | 'succeeded' | 'failed';
  lastRequest: string | null;
  lastResponse: AgentInvokeResponse | null;
  error: string | null;
  sessionId: string | null;
}

class AgentStore extends Store<AgentState> {
  constructor() {
    super({
      status: 'idle',
      lastRequest: null,
      lastResponse: null,
      error: null,
      sessionId: null,
    });
  }

  setInvoking(message: string, sessionId: string | null): void {
    this.updateState({
      status: 'invoking',
      lastRequest: message,
      sessionId,
      error: null,
    });
  }

  setSucceeded(response: AgentInvokeResponse, sessionId: string | null): void {
    this.updateState({
      status: 'succeeded',
      lastResponse: response,
      sessionId,
      error: response.errors.length ? response.errors.join('; ') : null,
    });
  }

  setFailed(message: string): void {
    this.updateState({
      status: 'failed',
      error: message,
    });
  }

  setCancelled(): void {
    this.updateState({
      status: 'idle',
      error: null,
    });
  }
}

export const agentStore = new AgentStore();

class AgentManager {
  private abortController: AbortController | null = null;

  /** Cancel an in-flight agent stream (event-driven; no fake timers). */
  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;
    const snap = agentStore.getSnapshot();
    if (snap.status === 'invoking') {
      agentStore.setCancelled();
    }
  }

  /**
   * Invoke the real backend agent graph.
   * Mirrors progress into ExecutionStore so the existing dashboard stays event-shaped
   * (HTTP completion path — ExecutionRuntime WS events are separate when that path runs).
   */
  async invoke(
    request: AgentInvokeRequest,
    opts?: { resetExecution?: boolean },
  ): Promise<AgentInvokeResponse> {
    const sessionId = request.session_id ?? crypto.randomUUID();
    agentStore.setInvoking(request.message, sessionId);
    if (opts?.resetExecution !== false) {
      executionStore.resetSession(sessionId);
    }
    executionStore.applyLocalPipelineState('RUNNING', sessionId);

    notificationStore.addNotification({
      type: 'info',
      message: 'Agent Invoke Started',
      description: 'Calling backend /agent/invoke pipeline…',
    });

    try {
      const response = await api.invokeAgent({
        message: request.message,
        session_id: request.session_id ?? sessionId,
      });

      agentStore.setSucceeded(response, sessionId);
      const failed = response.errors.length > 0 && !response.final_answer;
      executionStore.applyLocalPipelineState(failed ? 'FAILED' : 'SUCCEEDED', sessionId);

      notificationStore.addNotification({
        type: failed ? 'error' : 'success',
        message: failed ? 'Agent Invoke Completed With Errors' : 'Agent Invoke Succeeded',
        description: response.final_answer?.slice(0, 200) || response.errors.join('; ') || 'No final answer.',
      });

      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      agentStore.setFailed(message);
      executionStore.applyLocalPipelineState('FAILED', sessionId);
      notificationStore.addNotification({
        type: 'error',
        message: 'Agent Invoke Failed',
        description: message,
      });
      throw err;
    }
  }

  /**
   * Stream the agent graph via SSE. Invokes `onUpdate` with the latest
   * accumulated partial response as each node publishes state. The returned
   * promise resolves with the final response once the stream completes.
   */
  async invokeStream(
    request: AgentInvokeRequest,
    opts?: {
      resetExecution?: boolean;
      onNodeStarted?: (node: string) => void;
      onUpdate?: (partial: Partial<AgentInvokeResponse>) => void;
      signal?: AbortSignal;
    },
  ): Promise<AgentInvokeResponse> {
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;
    if (opts?.signal) {
      if (opts.signal.aborted) controller.abort();
      else {
        opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    const sessionId = request.session_id ?? crypto.randomUUID();
    agentStore.setInvoking(request.message, sessionId);
    if (opts?.resetExecution !== false) {
      executionStore.resetSession(sessionId);
    }
    executionStore.applyLocalPipelineState('RUNNING', sessionId);

    const accumulated: Partial<AgentInvokeResponse> = {};

    try {
      const final = await api.streamAgent(
        {
          message: request.message,
          session_id: request.session_id ?? sessionId,
        },
        {
          signal: controller.signal,
          onNodeStarted: (node) => {
            opts?.onNodeStarted?.(node);
          },
          onNodeUpdated: (_node, partial) => {
            Object.assign(accumulated, partial);
            opts?.onUpdate?.({ ...accumulated });
          },
          onError: (message) => {
            agentStore.setFailed(message);
            executionStore.applyLocalPipelineState('FAILED', sessionId);
          },
        },
      );

      agentStore.setSucceeded(final, sessionId);
      const failed = final.errors.length > 0 && !final.final_answer;
      executionStore.applyLocalPipelineState(failed ? 'FAILED' : 'SUCCEEDED', sessionId);

      notificationStore.addNotification({
        type: failed ? 'error' : 'success',
        message: failed ? 'Agent Stream Completed With Errors' : 'Agent Stream Succeeded',
        description:
          final.final_answer?.slice(0, 200) || final.errors.join('; ') || 'No final answer.',
      });

      return final;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        agentStore.setCancelled();
        executionStore.applyLocalPipelineState('CANCELLED', sessionId);
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      agentStore.setFailed(message);
      executionStore.applyLocalPipelineState('FAILED', sessionId);
      notificationStore.addNotification({
        type: 'error',
        message: 'Agent Stream Failed',
        description: message,
      });
      throw err;
    } finally {
      if (this.abortController === controller) this.abortController = null;
    }
  }
}

export const agentManager = new AgentManager();

export function useAgent(): AgentState {
  return useSyncExternalStore(
    agentStore.subscribe.bind(agentStore),
    agentStore.getSnapshot.bind(agentStore)
  );
}
