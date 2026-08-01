import { useSyncExternalStore } from 'react';
import {
  api,
  KernelEvent,
  ExecutionState as KernelExecutionState,
  ExecutionEvent,
  ExecutionEventType,
  normalizeExecutionState,
} from './api';
import { graphEngine } from './graph';

// toolManager is loaded lazily inside initializeStateLayer to avoid a circular
// import: store → tools → Store (TDZ: "Cannot access 'Store' before initialization").

// --- Generic Base Store class (UI-agnostic) ---

export class Store<State> {
  private state: State;
  private listeners: Set<() => void> = new Set();

  constructor(initialState: State) {
    this.state = initialState;
  }

  public getSnapshot(): State {
    return this.state;
  }

  protected updateState(nextState: Partial<State> | ((state: State) => State)): void {
    if (typeof nextState === 'function') {
      this.state = nextState(this.state);
    } else {
      this.state = { ...this.state, ...nextState };
    }
    this.listeners.forEach(listener => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

// ============================================================================
// 1. Kernel Store
// ============================================================================

export interface KernelState {
  isOnline: boolean;
  bootStatus: 'idle' | 'booting' | 'online' | 'error';
  lastActivity: string | null;
  activeModels: string[];
}

class KernelStore extends Store<KernelState> {
  constructor() {
    super({
      isOnline: false,
      bootStatus: 'idle',
      lastActivity: null,
      activeModels: [],
    });
  }

  public setOnline(isOnline: boolean): void {
    this.updateState({ isOnline, lastActivity: new Date().toISOString() });
  }

  public setBootStatus(status: 'idle' | 'booting' | 'online' | 'error'): void {
    this.updateState({ 
      bootStatus: status,
      isOnline: status === 'online',
      lastActivity: new Date().toISOString()
    });
  }

  public setActiveModels(models: string[]): void {
    this.updateState({ activeModels: models });
  }
}

export const kernelStore = new KernelStore();

// ============================================================================
// 2. Workspace Store
// ============================================================================

export interface ProjectMetadata {
  id: string;
  name: string;
  path: string;
  tags: string[];
}

export interface WorkspaceState {
  activeProject: ProjectMetadata | null;
  activeSessionId: string | null;
  projects: ProjectMetadata[];
  /** Open center editor tabs (includes Milly views: prism, globe). */
  openPanes: string[];
  /** Focused pane id within openPanes. */
  activePane: string | null;
}

class WorkspaceStore extends Store<WorkspaceState> {
  constructor() {
    super({
      activeProject: null,
      activeSessionId: null,
      projects: [],
      openPanes: [],
      activePane: null,
    });
  }

  public setActiveProject(project: ProjectMetadata | null): void {
    this.updateState({ activeProject: project });
  }

  public setActiveSession(sessionId: string | null): void {
    this.updateState({ activeSessionId: sessionId });
  }

  public setProjects(projects: ProjectMetadata[]): void {
    this.updateState({ projects });
  }

  public setOpenPanes(panes: string[]): void {
    const current = this.getSnapshot().activePane;
    this.updateState({
      openPanes: panes,
      activePane: panes.includes(current ?? '') ? current : panes[panes.length - 1] ?? null,
    });
  }

  /** Open (or focus) a center editor tab — used by Milly Workspace Menu. */
  public openPane(paneId: string): void {
    this.updateState((s) => {
      const openPanes = s.openPanes.includes(paneId)
        ? s.openPanes
        : [...s.openPanes, paneId];
      return { ...s, openPanes, activePane: paneId };
    });
  }

  public closePane(paneId: string): void {
    this.updateState((s) => {
      const openPanes = s.openPanes.filter((p) => p !== paneId);
      const activePane =
        s.activePane === paneId ? openPanes[openPanes.length - 1] ?? null : s.activePane;
      return { ...s, openPanes, activePane };
    });
  }

  public setActivePane(paneId: string): void {
    if (!this.getSnapshot().openPanes.includes(paneId)) return;
    this.updateState({ activePane: paneId });
  }

  public handleWorkspaceEvent(eventType: string, data: any): void {
    switch (eventType) {
      case 'workspace.project_loaded':
        if (data.project) {
          this.setActiveProject(data.project);
        }
        break;
      case 'workspace.session_activated':
        if (data.session_id) {
          this.setActiveSession(data.session_id);
        }
        break;
      default:
        break;
    }
  }
}

export const workspaceStore = new WorkspaceStore();

// ============================================================================
// 3. Execution Store
// ============================================================================

export interface TaskNode {
  id: string;
  label: string;
  status: 'pending' | 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped';
  tool?: string;
  error?: string;
}

export interface ExecutionStoreState {
  activeSessionId: string | null;
  pipelineState: KernelExecutionState | 'IDLE';
  activeTaskId: string | null;
  tasks: Record<string, TaskNode>;
  events: ExecutionEvent[];
  progress: number;
}

class ExecutionStore extends Store<ExecutionStoreState> {
  constructor() {
    super({
      activeSessionId: null,
      pipelineState: 'IDLE',
      activeTaskId: null,
      tasks: {},
      events: [],
      progress: 0,
    });
  }

  public resetSession(sessionId: string): void {
    this.updateState({
      activeSessionId: sessionId,
      pipelineState: 'PENDING',
      activeTaskId: null,
      tasks: {},
      events: [],
      progress: 0,
    });
  }

  /**
   * Apply a pipeline state from a non-WS path (e.g. HTTP agent invoke).
   * Does not invent EventBus events — only updates local render state.
   */
  public applyLocalPipelineState(
    state: KernelExecutionState,
    sessionId?: string | null
  ): void {
    this.updateState((prev) => ({
      ...prev,
      activeSessionId: sessionId ?? prev.activeSessionId,
      pipelineState: state,
      progress: state === 'SUCCEEDED' || state === 'COMPLETED' ? 100 : prev.progress,
    }));
  }

  public handleRuntimeEvent(eventType: string, eventData: any): void {
    // Backend publishes ExecutionEvent.model_dump() as `data`
    const event = (eventData ?? {}) as ExecutionEvent;
    const subType = (
      eventType.startsWith('runtime.')
        ? eventType.replace('runtime.', '')
        : String(event.event_type || eventType)
    ) as ExecutionEventType;

    this.updateState(state => {
      const nextEvents = [...state.events, { ...event, event_type: subType }];
      let nextTasks = { ...state.tasks };
      let nextPipelineState = state.pipelineState;
      let nextActiveTaskId = state.activeTaskId;
      let nextProgress = state.progress;

      const stateTo = normalizeExecutionState(event.state_to);

      switch (subType) {
        case 'session_created':
          nextPipelineState = stateTo ?? 'PENDING';
          nextProgress = 0;
          nextTasks = {};
          break;
        case 'session_queued':
          nextPipelineState = stateTo ?? 'QUEUED';
          break;
        case 'session_started':
          nextPipelineState = stateTo ?? 'RUNNING';
          break;
        case 'session_paused':
          nextPipelineState = stateTo ?? 'PAUSED';
          break;
        case 'session_resumed':
          nextPipelineState = stateTo ?? 'RUNNING';
          break;
        case 'session_retrying':
          nextPipelineState = stateTo ?? 'RETRYING';
          break;
        case 'session_succeeded':
          nextPipelineState = stateTo ?? 'SUCCEEDED';
          nextProgress = 100;
          break;
        case 'session_failed':
          nextPipelineState = stateTo ?? 'FAILED';
          break;
        case 'session_cancelled':
          nextPipelineState = stateTo ?? 'CANCELLED';
          break;
        case 'session_completed':
          nextPipelineState = stateTo ?? 'COMPLETED';
          break;

        case 'task_started':
          if (event.task_id) {
            nextActiveTaskId = event.task_id;
            nextTasks[event.task_id] = {
              id: event.task_id,
              label: event.message || `Task ${event.task_id}`,
              status: 'running',
              tool: event.tool_id || undefined,
            };
          }
          break;

        case 'task_succeeded':
          if (event.task_id) {
            nextTasks[event.task_id] = {
              ...(nextTasks[event.task_id] || {
                id: event.task_id,
                label: event.message || event.task_id,
              }),
              status: 'succeeded',
            };
            if (nextActiveTaskId === event.task_id) {
              nextActiveTaskId = null;
            }
          }
          break;

        case 'task_failed':
          if (event.task_id) {
            nextTasks[event.task_id] = {
              ...(nextTasks[event.task_id] || {
                id: event.task_id,
                label: event.message || event.task_id,
              }),
              status: 'failed',
              error: event.message,
            };
            if (nextActiveTaskId === event.task_id) {
              nextActiveTaskId = null;
            }
          }
          break;

        case 'task_skipped':
          if (event.task_id) {
            nextTasks[event.task_id] = {
              ...(nextTasks[event.task_id] || {
                id: event.task_id,
                label: event.message || event.task_id,
              }),
              status: 'skipped',
            };
          }
          break;

        case 'progress_updated':
          if (event.data && typeof (event.data as { progress?: number }).progress === 'number') {
            nextProgress = (event.data as { progress: number }).progress;
          }
          break;

        default:
          break;
      }

      return {
        ...state,
        activeSessionId: event.session_id || state.activeSessionId,
        pipelineState: nextPipelineState,
        activeTaskId: nextActiveTaskId,
        tasks: nextTasks,
        events: nextEvents,
        progress: nextProgress,
      };
    });
  }
}

export const executionStore = new ExecutionStore();

// ============================================================================
// 4. Notification Store
// ============================================================================

export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'validation'
  | 'progress';

export interface SystemNotification {
  id: string;
  type: NotificationType;
  message: string;
  description?: string;
  timestamp: string;
  read: boolean;
  actionable?: boolean;
  /** 0–100 for `progress` notifications; undefined renders an indeterminate bar. */
  progress?: number;
}

export interface NotificationState {
  notifications: SystemNotification[];
}

class NotificationStore extends Store<NotificationState> {
  /** Execution session id → progress notification id. */
  private sessionProgress = new Map<string, string>();
  /** Mirrors settings.general.enableNotifications (errors always pass). */
  private enabled = true;

  constructor() {
    super({
      notifications: [],
    });
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public addNotification(
    notification: Omit<SystemNotification, 'id' | 'timestamp' | 'read'>,
  ): string {
    // Respect the user's preference. Errors and validation always surface —
    // silencing them would hide failures.
    if (
      !this.enabled &&
      notification.type !== 'error' &&
      notification.type !== 'validation'
    ) {
      return '';
    }
    const now = Date.now();
    const id = Math.random().toString(36).substring(2, 9);
    this.updateState((state) => {
      const duplicate = state.notifications.find((n) => {
        const samePayload =
          !n.read &&
          n.type === notification.type &&
          n.message === notification.message &&
          (n.description ?? '') === (notification.description ?? '');
        if (!samePayload) return false;
        const ageMs = now - new Date(n.timestamp).getTime();
        return ageMs < 5000;
      });
      if (duplicate) return state;

      const newNotif: SystemNotification = {
        ...notification,
        id,
        timestamp: new Date().toISOString(),
        read: false,
      };
      return {
        notifications: [newNotif, ...state.notifications],
      };
    });
    return id;
  }

  public updateNotification(
    id: string,
    patch: Partial<Omit<SystemNotification, 'id' | 'timestamp'>>,
  ): void {
    this.updateState((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, ...patch } : n,
      ),
    }));
  }

  /** Dismiss a toast (keeps it in history as read). */
  public dismiss(id: string): void {
    this.updateState(state => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
    }));
  }

  /** @deprecated Alias for {@link dismiss}. */
  public markAsRead(id: string): void {
    this.dismiss(id);
  }

  public dismissAll(): void {
    this.updateState((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  }

  // --- Progress notifications (long-running operations) ---

  /** Begin a progress notification. Returns the notification id. */
  public beginProgress(message: string, description?: string): string {
    return this.addNotification({ type: 'progress', message, description });
  }

  /** Update a progress notification (0–100; omit for indeterminate). */
  public setProgress(id: string, progress?: number, description?: string): void {
    this.updateNotification(id, {
      progress: typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : undefined,
      ...(description !== undefined ? { description } : {}),
    });
  }

  /** Resolve a progress notification into a terminal state. */
  public endProgress(
    id: string,
    outcome: { type: Exclude<NotificationType, 'progress'>; message: string; description?: string },
  ): void {
    this.updateNotification(id, {
      type: outcome.type,
      message: outcome.message,
      description: outcome.description,
      progress: undefined,
    });
  }

  public handleKernelEvent(eventType: string, data: any): void {
    // Automatically trigger notification banners based on critical events
    if (eventType === 'kernel_boot' && data?.status === 'success') {
      this.addNotification({
        type: 'success',
        message: 'PRISM Kernel Online',
        description: 'Successfully initialized mind registries and connection routes.',
      });
      return;
    }

    const sessionId: string | undefined =
      typeof data?.session_id === 'string' ? data.session_id : undefined;

    if (eventType.endsWith('session_started') && sessionId) {
      if (!this.sessionProgress.has(sessionId)) {
        const id = this.beginProgress(
          'Execution session running',
          data?.message || `Session ${sessionId}`,
        );
        this.sessionProgress.set(sessionId, id);
      }
    } else if (eventType.endsWith('progress_updated') && sessionId) {
      const id = this.sessionProgress.get(sessionId);
      const progress = (data?.data as { progress?: number } | undefined)?.progress;
      if (id && typeof progress === 'number') {
        this.setProgress(id, progress);
      }
    } else if (eventType.endsWith('session_succeeded') && sessionId) {
      const id = this.sessionProgress.get(sessionId);
      this.sessionProgress.delete(sessionId);
      if (id) {
        this.endProgress(id, {
          type: 'success',
          message: 'Execution session completed',
          description: data?.message || `Session ${sessionId} finished successfully.`,
        });
      }
    } else if (eventType.endsWith('session_failed')) {
      const id = sessionId ? this.sessionProgress.get(sessionId) : undefined;
      if (sessionId) this.sessionProgress.delete(sessionId);
      if (id) {
        this.endProgress(id, {
          type: 'error',
          message: 'Execution Session Failed',
          description: data?.message || `Session ${sessionId} ended with errors.`,
        });
      } else {
        this.addNotification({
          type: 'error',
          message: 'Execution Session Failed',
          description: data?.message || `Session ${data?.session_id} ended with errors.`,
        });
      }
    } else if (eventType.endsWith('session_cancelled') && sessionId) {
      const id = this.sessionProgress.get(sessionId);
      this.sessionProgress.delete(sessionId);
      if (id) {
        this.endProgress(id, {
          type: 'warning',
          message: 'Execution session cancelled',
          description: data?.message || `Session ${sessionId} was cancelled.`,
        });
      }
    } else if (eventType.endsWith('cancellation_requested')) {
      this.addNotification({
        type: 'warning',
        message: 'Cancellation Requested',
        description: `Cancelling execution session: ${data?.session_id}`,
      });
    } else if (eventType.endsWith('validation')) {
      this.addNotification({
        type: 'validation',
        message: 'Manual Validation Required',
        description: data?.message || 'Execution halted pending developer approval.',
        actionable: true,
      });
    }
  }
}

export const notificationStore = new NotificationStore();

// ============================================================================
// 5. Global Event Routing Setup
// ============================================================================

let isApiClientSubscriptionActive = false;

/**
 * Initializes the client-side state listeners. It connects to the PrismApiClient,
 * registers store callback handlers, and initiates the WebSocket connection.
 */
export function initializeStateLayer(): void {
  if (isApiClientSubscriptionActive) return;

  api.subscribe((event: KernelEvent) => {
    const { event_type, data } = event;

    // 1. Route to Kernel Store
    if (event_type === 'kernel_boot') {
      kernelStore.setBootStatus('online');
    } else if (event_type === 'kernel_shutdown') {
      kernelStore.setBootStatus('idle');
    }

    // 2. Route to Workspace Store
    if (event_type.startsWith('workspace.')) {
      workspaceStore.handleWorkspaceEvent(event_type, data);
    }

    // 3. Route to Execution Store
    if (event_type.startsWith('runtime.')) {
      executionStore.handleRuntimeEvent(event_type, data);

      const subType = event_type.replace('runtime.', '');
      const payload =
        data !== null && typeof data === 'object'
          ? (data as Record<string, unknown>)
          : {};
      const runtimeEvent = {
        ...payload,
        event_type: subType,
      };

      graphEngine.handleRuntimeEvent(runtimeEvent as ExecutionEvent);
      void import('./tools').then(({ toolManager }) => {
        toolManager.handleRuntimeEvent(runtimeEvent as ExecutionEvent);
      });
    }

    // 4. Route to Notifications Store
    notificationStore.handleKernelEvent(event_type, data);
  });

  // Reflect real WebSocket connectivity (no optimistic online flag)
  api.onConnectionChange((connected) => {
    kernelStore.setOnline(connected);
  });

  isApiClientSubscriptionActive = true;
}

// ============================================================================
// 6. React Typed Selector Hooks
// ============================================================================

export function useKernel(): KernelState {
  return useSyncExternalStore(
    kernelStore.subscribe.bind(kernelStore),
    kernelStore.getSnapshot.bind(kernelStore)
  );
}

export function useWorkspace(): WorkspaceState {
  return useSyncExternalStore(
    workspaceStore.subscribe.bind(workspaceStore),
    workspaceStore.getSnapshot.bind(workspaceStore)
  );
}

export function useExecution(): ExecutionStoreState {
  return useSyncExternalStore(
    executionStore.subscribe.bind(executionStore),
    executionStore.getSnapshot.bind(executionStore)
  );
}

export function useNotifications(): NotificationState {
  return useSyncExternalStore(
    notificationStore.subscribe.bind(notificationStore),
    notificationStore.getSnapshot.bind(notificationStore)
  );
}
