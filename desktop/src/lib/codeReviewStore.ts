/**
 * Pending code-review proposals — UI/runtime store, not a Manager.
 * Holds transactional patches until Accept / Reject.
 */

import { useSyncExternalStore } from 'react';
import { Store } from './store';
import type { FilePatch } from './patch';

export type ReviewDecision = 'pending' | 'accepted' | 'rejected' | 'rolled_back';

export interface CodeReviewProposal {
  id: string;
  sessionId: string;
  createdAt: string;
  userMessage: string;
  planSummary: string;
  source: 'agent';
  files: FilePatch[];
  decision: ReviewDecision;
  /** Snapshots keyed by absolute path — used for rollback after apply */
  appliedSnapshots?: Record<string, string>;
}

export interface CodeReviewState {
  activeProposal: CodeReviewProposal | null;
  lastProposal: CodeReviewProposal | null;
}

class CodeReviewStore extends Store<CodeReviewState> {
  constructor() {
    super({ activeProposal: null, lastProposal: null });
  }

  setProposal(proposal: CodeReviewProposal): void {
    this.updateState({ activeProposal: proposal });
  }

  updateFiles(files: FilePatch[]): void {
    const active = this.getSnapshot().activeProposal;
    if (!active) return;
    this.updateState({ activeProposal: { ...active, files } });
  }

  acceptFile(relativePath: string): void {
    const active = this.getSnapshot().activeProposal;
    if (!active) return;
    const files = active.files.map((f) =>
      f.relativePath === relativePath ? { ...f, status: 'accepted' as const } : f,
    );
    this.updateState({ activeProposal: { ...active, files } });
  }

  rejectFile(relativePath: string): void {
    const active = this.getSnapshot().activeProposal;
    if (!active) return;
    const files = active.files.map((f) =>
      f.relativePath === relativePath ? { ...f, status: 'rejected' as const } : f,
    );
    this.updateState({ activeProposal: { ...active, files } });
  }

  acceptAllPending(): void {
    const active = this.getSnapshot().activeProposal;
    if (!active) return;
    const files = active.files.map((f) =>
      f.status === 'pending' ? { ...f, status: 'accepted' as const } : f,
    );
    this.updateState({ activeProposal: { ...active, files } });
  }

  rejectAllPending(): void {
    const active = this.getSnapshot().activeProposal;
    if (!active) return;
    const files = active.files.map((f) =>
      f.status === 'pending' ? { ...f, status: 'rejected' as const } : f,
    );
    this.updateState({ activeProposal: { ...active, files } });
  }

  complete(decision: ReviewDecision, appliedSnapshots?: Record<string, string>): void {
    const active = this.getSnapshot().activeProposal;
    if (!active) return;
    const finished: CodeReviewProposal = {
      ...active,
      decision,
      appliedSnapshots,
    };
    this.updateState({ activeProposal: null, lastProposal: finished });
  }

  markLastRolledBack(): void {
    const last = this.getSnapshot().lastProposal;
    if (!last) return;
    this.updateState({
      lastProposal: { ...last, decision: 'rolled_back' },
    });
  }

  clear(): void {
    this.updateState({ activeProposal: null });
  }
}

export const codeReviewStore = new CodeReviewStore();

export function useCodeReview(): CodeReviewState {
  return useSyncExternalStore(
    codeReviewStore.subscribe.bind(codeReviewStore),
    codeReviewStore.getSnapshot.bind(codeReviewStore),
  );
}
