/**
 * Memory manager — thin client over backend MemoryService.
 * No local mock memory; backend is source of truth.
 */

import { useSyncExternalStore } from 'react';
import {
  api,
  MemoryCreateRequest,
  MemoryRecord,
  MemorySearchRequest,
  MemorySearchResult,
} from './api';
import { Store } from './store';

export interface MemoryState {
  lastResults: MemorySearchResult[];
  lastCreated: MemoryRecord | null;
  lastQuery: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  backendReachable: boolean | null;
}

class MemoryStore extends Store<MemoryState> {
  constructor() {
    super({
      lastResults: [],
      lastCreated: null,
      lastQuery: null,
      status: 'idle',
      error: null,
      backendReachable: null,
    });
  }

  setLoading(): void {
    this.updateState({ status: 'loading', error: null });
  }

  setResults(query: string, results: MemorySearchResult[]): void {
    this.updateState({
      lastQuery: query,
      lastResults: results,
      status: 'ready',
      error: null,
      backendReachable: true,
    });
  }

  setCreated(memory: MemoryRecord): void {
    this.updateState({
      lastCreated: memory,
      status: 'ready',
      error: null,
      backendReachable: true,
    });
  }

  setError(message: string): void {
    this.updateState({
      status: 'error',
      error: message,
      backendReachable: false,
    });
  }

  setReachable(ok: boolean): void {
    this.updateState({ backendReachable: ok });
  }

  markReady(): void {
    this.updateState({ status: 'ready', error: null });
  }
}

export const memoryStore = new MemoryStore();

class MemoryManager {
  async search(request: MemorySearchRequest): Promise<MemorySearchResult[]> {
    memoryStore.setLoading();
    try {
      const results = await api.searchMemories(request);
      memoryStore.setResults(request.query, results);
      return results;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      memoryStore.setError(message);
      throw err;
    }
  }

  async create(request: MemoryCreateRequest): Promise<MemoryRecord> {
    memoryStore.setLoading();
    try {
      const memory = await api.createMemory(request);
      memoryStore.setCreated(memory);
      return memory;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      memoryStore.setError(message);
      throw err;
    }
  }

  async get(memoryId: string): Promise<MemoryRecord> {
    memoryStore.setLoading();
    try {
      const memory = await api.getMemory(memoryId);
      memoryStore.setCreated(memory);
      return memory;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      memoryStore.setError(message);
      throw err;
    }
  }

  async delete(memoryId: string): Promise<void> {
    memoryStore.setLoading();
    try {
      await api.deleteMemory(memoryId);
      memoryStore.setReachable(true);
      memoryStore.markReady();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      memoryStore.setError(message);
      throw err;
    }
  }

  async probe(): Promise<boolean> {
    try {
      await api.getHealth();
      memoryStore.setReachable(true);
      return true;
    } catch {
      memoryStore.setReachable(false);
      return false;
    }
  }
}

export const memoryManager = new MemoryManager();

export function useMemory(): MemoryState {
  return useSyncExternalStore(
    memoryStore.subscribe.bind(memoryStore),
    memoryStore.getSnapshot.bind(memoryStore)
  );
}
