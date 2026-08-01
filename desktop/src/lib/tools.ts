import { useSyncExternalStore } from 'react';
import { Store, notificationStore } from './store';
import { ExecutionEvent } from './api';

// --- Type Definitions matching Tool Runtime specs ---

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  parametersSchema?: Record<string, any>;
}

export interface ToolLogLine {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  stream: 'stdout' | 'stderr';
}

export interface ToolRunSession {
  id: string;
  toolId: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  startedAt: string;
  completedAt?: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
  logs: ToolLogLine[];
}

// --- Tool Store (UI-Agnostic) ---

export interface ToolState {
  registeredTools: ToolDefinition[];
  activeSessions: Record<string, ToolRunSession>;
  completedSessions: ToolRunSession[];
}

class ToolStore extends Store<ToolState> {
  constructor() {
    super({
      registeredTools: [],
      activeSessions: {},
      completedSessions: [],
    });
  }

  public registerTool(tool: ToolDefinition): void {
    this.updateState(state => {
      if (state.registeredTools.some(t => t.id === tool.id)) {
        return state;
      }
      return {
        ...state,
        registeredTools: [...state.registeredTools, tool],
      };
    });
  }

  public unregisterTool(toolId: string): void {
    this.updateState(state => ({
      ...state,
      registeredTools: state.registeredTools.filter(t => t.id !== toolId),
    }));
  }

  public startSession(session: ToolRunSession): void {
    this.updateState(state => ({
      ...state,
      activeSessions: {
        ...state.activeSessions,
        [session.id]: session,
      },
    }));
  }

  public updateSession(
    sessionId: string, 
    update: Partial<Omit<ToolRunSession, 'id' | 'logs'>>
  ): void {
    this.updateState(state => {
      const active = { ...state.activeSessions };
      const session = active[sessionId];
      if (!session) return state;

      const updatedSession = { ...session, ...update };
      
      if (updatedSession.status === 'succeeded' || updatedSession.status === 'failed') {
        delete active[sessionId];
        return {
          ...state,
          activeSessions: active,
          completedSessions: [updatedSession, ...state.completedSessions],
        };
      }

      return {
        ...state,
        activeSessions: {
          ...active,
          [sessionId]: updatedSession,
        },
      };
    });
  }

  public appendLog(sessionId: string, log: ToolLogLine): void {
    this.updateState(state => {
      const active = { ...state.activeSessions };
      const session = active[sessionId];
      if (!session) return state;

      const updatedSession = {
        ...session,
        logs: [...session.logs, log],
      };

      return {
        ...state,
        activeSessions: {
          ...active,
          [sessionId]: updatedSession,
        },
      };
    });
  }
}

export const toolStore = new ToolStore();

// --- ToolManager Service ---

class ToolManager {
  constructor() {
    // Register core execution tools
    this.registerTool({
      id: 'docker_execute',
      name: 'Docker Container Executor',
      description: 'Run commands inside isolated Docker environments',
      capabilities: ['environment:sandbox', 'exec:command'],
      parametersSchema: {
        type: 'object',
        properties: {
          image: { type: 'string' },
          command: { type: 'string' },
        },
        required: ['image', 'command'],
      },
    });

    this.registerTool({
      id: 'python_sandbox',
      name: 'Local Python Sandbox',
      description: 'Execute Python scripts in a safe, monitored subprocess runtime',
      capabilities: ['exec:python', 'eval:code'],
      parametersSchema: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          timeout: { type: 'number' },
        },
        required: ['code'],
      },
    });

    this.registerTool({
      id: 'file_editor',
      name: 'Filesystem Editor',
      description: 'Read and write local files with dependency diff checks',
      capabilities: ['fs:read', 'fs:write'],
      parametersSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
          operation: { type: 'string', enum: ['read', 'write', 'patch'] },
        },
        required: ['path', 'operation'],
      },
    });
  }

  public registerTool(tool: ToolDefinition): void {
    toolStore.registerTool(tool);
  }

  public unregisterTool(toolId: string): void {
    toolStore.unregisterTool(toolId);
  }

  /**
   * Initialize a new tool running session.
   */
  public startToolRun(toolId: string, parameters: Record<string, any> = {}): string {
    const runId = `tool_run_${Math.random().toString(36).substring(2, 9)}`;
    const session: ToolRunSession = {
      id: runId,
      toolId,
      status: 'pending',
      startedAt: new Date().toISOString(),
      parameters,
      logs: [],
    };

    toolStore.startSession(session);
    return runId;
  }

  /**
   * Update the status of a running tool.
   */
  public updateToolRun(
    runId: string, 
    status: ToolRunSession['status'], 
    extra: Partial<Omit<ToolRunSession, 'id' | 'logs' | 'status'>> = {}
  ): void {
    const update = {
      status,
      completedAt: ['succeeded', 'failed'].includes(status) ? new Date().toISOString() : undefined,
      ...extra,
    };
    toolStore.updateSession(runId, update);
  }

  /**
   * Aggregate logs generated during tool execution.
   */
  public log(
    runId: string, 
    level: ToolLogLine['level'], 
    message: string, 
    stream: ToolLogLine['stream'] = 'stdout'
  ): void {
    const logLine: ToolLogLine = {
      timestamp: new Date().toISOString(),
      level,
      message,
      stream,
    };
    toolStore.appendLog(runId, logLine);
  }

  /**
   * Handles incoming runtime execution events to track bounded tool lifecycles automatically.
   */
  public handleRuntimeEvent(event: ExecutionEvent): void {
    const toolId = event.tool_id;
    const taskId = event.task_id;
    if (!toolId || !taskId) return;

    // Check if we are already tracking this run ID
    const runId = `run_${taskId}`;
    const activeSessions = toolStore.getSnapshot().activeSessions;

    if (event.event_type === 'task_started') {
      const session: ToolRunSession = {
        id: runId,
        toolId,
        status: 'running',
        startedAt: event.timestamp || new Date().toISOString(),
        parameters: event.data || {},
        logs: [],
      };
      toolStore.startSession(session);
      this.log(runId, 'info', `Initialized execution step for tool: ${toolId}`);
    } else if (activeSessions[runId]) {
      if (event.event_type === 'task_succeeded') {
        this.log(runId, 'info', `Tool execution succeeded: ${event.message || 'Ok'}`);
        this.updateToolRun(runId, 'succeeded', { result: event.data });
      } else if (event.event_type === 'task_failed') {
        this.log(runId, 'error', `Tool execution failed: ${event.message || 'Unknown error'}`, 'stderr');
        this.updateToolRun(runId, 'failed', { error: event.message });
        
        notificationStore.addNotification({
          type: 'error',
          message: `Tool Failed: ${toolId}`,
          description: event.message || 'Execution error during subprocess tool call.',
        });
      }
    }
  }
}

export const toolManager = new ToolManager();
export default toolManager;

// --- React selector hook ---

export function useTools(): ToolState {
  return useSyncExternalStore(
    toolStore.subscribe.bind(toolStore),
    toolStore.getSnapshot.bind(toolStore)
  );
}
