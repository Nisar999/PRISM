import { Store, executionStore, kernelStore, notificationStore } from './store';
import { useSyncExternalStore } from 'react';

export type MillyPresenceState =
  | 'idle'
  | 'thinking'
  | 'planning'
  | 'retrieving'
  | 'routing'
  | 'executing'
  | 'reflecting'
  | 'validation'
  | 'waiting'
  | 'paused'
  | 'success'
  | 'failure';

export interface MillyState {
  activeState: MillyPresenceState;
  attentionLevel: 'zero' | 'low' | 'medium' | 'high';
  message: string | null;
}

class MillyStore extends Store<MillyState> {
  constructor() {
    super({
      activeState: 'idle',
      attentionLevel: 'zero',
      message: 'PRISM initialized and idling.',
    });
  }

  public setPresence(
    activeState: MillyPresenceState, 
    attentionLevel: MillyState['attentionLevel'],
    message: string | null = null
  ): void {
    this.updateState({ activeState, attentionLevel, message });
  }
}

export const millyStore = new MillyStore();

// --- MillyEngine Service ---

class MillyEngine {
  private isListening = false;
  private successTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Setup store listeners to monitor states and synchronize Milly
   */
  public startSync(): void {
    if (this.isListening) return;

    // Listen to changes in the Execution Store
    executionStore.subscribe(() => this.synchronize());
    // Listen to changes in the Kernel Store
    kernelStore.subscribe(() => this.synchronize());
    // Listen to changes in the Notification Store
    notificationStore.subscribe(() => this.synchronize());

    this.isListening = true;
    this.synchronize();
  }

  /**
   * Synchronize Milly state with Kernel, Execution, and Notification layers
   */
  private synchronize(): void {
    const kState = kernelStore.getSnapshot();
    const eState = executionStore.getSnapshot();
    const nState = notificationStore.getSnapshot();

    // 1. Critical Failures / Error states
    if (eState.pipelineState === 'FAILED') {
      millyStore.setPresence('failure', 'high', 'Execution encountered an unrecoverable failure.');
      return;
    }

    // 2. Human validation requirements (highest priority active state)
    const activeValidation = nState.notifications.find(n => n.type === 'validation' && !n.read);
    if (activeValidation) {
      millyStore.setPresence('validation', 'high', activeValidation.message);
      return;
    }

    // 3. Kernel Offline / Waiting state
    if (!kState.isOnline) {
      millyStore.setPresence('waiting', 'zero', 'Connecting to PRISM Kernel...');
      return;
    }

    // 4. Execution states
    switch (eState.pipelineState) {
      case 'PENDING':
        millyStore.setPresence('thinking', 'low', 'Parsing goal intent...');
        break;
      
      case 'QUEUED':
        millyStore.setPresence('planning', 'medium', 'Decomposing task dependencies...');
        break;
      
      case 'RUNNING':
        // Determine sub-action based on active task
        if (eState.activeTaskId) {
          const activeTask = eState.tasks[eState.activeTaskId];
          if (activeTask?.tool === 'router') {
            millyStore.setPresence('routing', 'low', `Evaluating routing paths...`);
          } else if (activeTask?.tool === 'memory') {
            millyStore.setPresence('retrieving', 'low', 'Traversing semantic memory vectors...');
          } else {
            millyStore.setPresence('executing', 'medium', `Executing: ${activeTask?.label || 'active task'}`);
          }
        } else {
          millyStore.setPresence('executing', 'medium', 'Executing active pipeline.');
        }
        break;
      
      case 'RETRYING':
        millyStore.setPresence('thinking', 'medium', 'Analyzing output, scheduling retries...');
        break;
      
      case 'PAUSED':
        millyStore.setPresence('paused', 'low', 'Pipeline execution suspended.');
        break;
      
      case 'SUCCEEDED':
      case 'COMPLETED':
        // Trigger temporary success animation
        this.triggerSuccessSettle();
        break;
      
      case 'IDLE':
      default:
        // System is idling
        millyStore.setPresence('idle', 'zero', 'System idle. Awaiting instruction.');
        break;
    }
  }

  private triggerSuccessSettle(): void {
    const current = millyStore.getSnapshot();
    if (current.activeState === 'success') return;

    millyStore.setPresence('success', 'medium', 'Goal accomplished successfully.');

    if (this.successTimeoutId) {
      clearTimeout(this.successTimeoutId);
    }

    this.successTimeoutId = setTimeout(() => {
      this.successTimeoutId = null;
      // Re-synchronize back to idle (or current state)
      this.synchronize();
    }, 4000);
  }
}

export const millyEngine = new MillyEngine();
export default millyEngine;

// --- React hook ---

export function useMilly(): MillyState {
  return useSyncExternalStore(
    millyStore.subscribe.bind(millyStore),
    millyStore.getSnapshot.bind(millyStore)
  );
}
