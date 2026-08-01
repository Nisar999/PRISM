/**
 * PRISM Backend API Client
 *
 * Typed desktop contract for FastAPI. Backend owns intelligence; this module
 * only transports state. REST success payloads use `{ data, meta }` — unwrapped here.
 *
 * Canonical contract: docs/API_SURFACE.md
 */

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://127.0.0.1:8000/api/v1';
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

// ---------------------------------------------------------------------------
// Shared / envelope helpers
// ---------------------------------------------------------------------------

export interface ApiClientOptions extends RequestInit {
  params?: Record<string, string>;
}

export interface MetaResponse {
  timestamp?: string | null;
}

/** Unwrap FastAPI `{ data, meta }` envelopes; pass through bare payloads. */
export function unwrapData<T>(payload: unknown): T {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'data' in payload &&
    (payload as { data: unknown }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthStatus {
  status: string;
  version: string;
  environment: string;
  services: Record<string, boolean>;
}

export interface ReadinessStatus {
  ready: boolean;
  checks: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export type MemoryType =
  | 'episodic'
  | 'semantic'
  | 'procedural'
  | 'temporal'
  | 'failure';

export interface MemoryCreateRequest {
  content: string;
  session_id?: string | null;
  memory_type?: MemoryType | null;
  metadata?: Record<string, unknown>;
}

export interface MemoryRecord {
  id: string;
  session_id: string | null;
  memory_type: MemoryType;
  content: string;
  trust: number;
  mem_score: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MemorySearchRequest {
  query: string;
  memory_types?: MemoryType[] | null;
  limit?: number;
  min_trust?: number;
}

export interface MemorySearchResult {
  memory: MemoryRecord;
  relevance_score: number;
  source: string;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export interface AgentInvokeRequest {
  message: string;
  session_id?: string | null;
  /** Preferred provider id from ProviderManager (ollama, openrouter, …). */
  provider?: string | null;
  /** Preferred model id discovered for that provider. */
  model?: string | null;
  /** Optional API key for cloud providers (OpenRouter from Settings). */
  api_key?: string | null;
}

export interface AgentInvokeResponse {
  final_answer: string | null;
  plan: string | null;
  reasoning: string | null;
  reflection: string | null;
  trust_score: number;
  retrieved_memories: Record<string, unknown>[];
  healing_actions: Record<string, unknown>[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ProviderChatRequest {
  messages?: ChatMessage[] | null;
  message?: string | null;
  provider?: string | null;
  model?: string | null;
  temperature?: number;
  max_tokens?: number | null;
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  usage: Record<string, unknown>;
  finish_reason: string | null;
}

export interface ModelInfo {
  id: string;
  provider: string;
  supports_vision: boolean;
  supports_tools: boolean;
}

export interface ProviderHealth {
  provider: string;
  healthy: boolean;
  latency_ms?: number | null;
  message?: string | null;
}

// ---------------------------------------------------------------------------
// Execution / WebSocket event types (EventBus → WS)
// ---------------------------------------------------------------------------

/** Desktop pipeline display states (uppercase). Backend emits lowercase. */
export type ExecutionState =
  | 'PENDING'
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'RETRYING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'COMPLETED';

export type ExecutionEventType =
  | 'session_created'
  | 'session_queued'
  | 'session_started'
  | 'session_paused'
  | 'session_resumed'
  | 'session_retrying'
  | 'session_succeeded'
  | 'session_failed'
  | 'session_cancelled'
  | 'session_completed'
  | 'task_started'
  | 'task_succeeded'
  | 'task_failed'
  | 'task_skipped'
  | 'artifact_registered'
  | 'progress_updated'
  | 'retry_scheduled'
  | 'cancellation_requested';

export interface ExecutionEvent {
  id: string;
  session_id: string;
  event_type: ExecutionEventType | string;
  timestamp: string;
  state_from?: string;
  state_to?: string;
  task_id?: string | null;
  tool_id?: string | null;
  message: string;
  data: Record<string, unknown>;
}

export interface KernelEvent {
  event_type: string;
  data: unknown;
}

/** Normalize backend lowercase execution states to desktop uppercase. */
export function normalizeExecutionState(value?: string | null): ExecutionState | undefined {
  if (!value) return undefined;
  return value.toUpperCase() as ExecutionState;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class PrismApiClient {
  private ws: WebSocket | null = null;
  private wsListeners: Set<(event: KernelEvent) => void> = new Set();
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  private eventHistory: KernelEvent[] = [];
  private maxHistorySize = 1000;
  private connected = false;

  private reconnectAttempts = 0;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isExplicitClosed = false;

  private setConnected(connected: boolean): void {
    if (this.connected === connected) return;
    this.connected = connected;
    this.connectionListeners.forEach((listener) => {
      try {
        listener(connected);
      } catch (err) {
        console.error('Error executing connection listener:', err);
      }
    });
  }

  private async request<T>(endpoint: string, options: ApiClientOptions = {}): Promise<T> {
    const { params, ...customConfig } = options;

    let url = `${API_BASE_URL}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const config: RequestInit = {
      ...customConfig,
      headers: {
        'Content-Type': 'application/json',
        ...customConfig.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        let detail = `${response.status} ${response.statusText}`;
        try {
          const errBody = await response.json();
          if (errBody?.detail) detail = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
          if (errBody?.error?.message) detail = errBody.error.message;
        } catch {
          /* ignore parse errors */
        }
        throw new Error(`API Error: ${detail}`);
      }
      if (response.status === 204) {
        return undefined as T;
      }
      const json = await response.json();
      return unwrapData<T>(json);
    } catch (error) {
      console.error(`Error in PrismApiClient for ${endpoint}:`, error);
      throw error;
    }
  }

  // --- Health ---

  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  async getReady(): Promise<ReadinessStatus> {
    return this.request<ReadinessStatus>('/ready');
  }

  // --- Memory (backend MemoryService) ---

  async createMemory(body: MemoryCreateRequest): Promise<MemoryRecord> {
    return this.request<MemoryRecord>('/memory', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getMemory(memoryId: string): Promise<MemoryRecord> {
    return this.request<MemoryRecord>(`/memory/${memoryId}`);
  }

  async searchMemories(body: MemorySearchRequest): Promise<MemorySearchResult[]> {
    return this.request<MemorySearchResult[]>('/memory/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async deleteMemory(memoryId: string): Promise<void> {
    await this.request<void>(`/memory/${memoryId}`, { method: 'DELETE' });
  }

  // --- Agent (LangGraph pipeline) ---

  async invokeAgent(body: AgentInvokeRequest): Promise<AgentInvokeResponse> {
    return this.request<AgentInvokeResponse>('/agent/invoke', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Stream agent pipeline updates as Server-Sent Events.
   * The caller supplies callbacks invoked as each SSE frame arrives; the
   * returned promise resolves with the final response once the stream closes.
   */
  async streamAgent(
    body: AgentInvokeRequest,
    handlers: {
      onNodeStarted?: (node: string) => void;
      onNodeUpdated?: (node: string, partial: Partial<AgentInvokeResponse>) => void;
      onError?: (message: string) => void;
      signal?: AbortSignal;
    } = {},
  ): Promise<AgentInvokeResponse> {
    const url = `${API_BASE_URL}/agent/stream`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal: handlers.signal,
    });
    if (!response.ok || !response.body) {
      const detail = `${response.status} ${response.statusText}`;
      throw new Error(`API Error: ${detail}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let final: AgentInvokeResponse | null = null;

    const onAbort = () => {
      void reader.cancel();
    };
    handlers.signal?.addEventListener('abort', onAbort);

    // SSE frames are separated by a blank line. Each frame has `event:` and `data:` lines.
    const parseFrame = (frame: string): void => {
      const lines = frame.split('\n');
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) return;
      const dataStr = dataLines.join('\n');
      let data: unknown;
      try {
        data = JSON.parse(dataStr);
      } catch {
        return;
      }
      switch (event) {
        case 'node_started':
          handlers.onNodeStarted?.(((data as { node?: string }).node) ?? '');
          break;
        case 'node_updated': {
          const d = data as { node?: string; state?: Record<string, unknown> };
          handlers.onNodeUpdated?.(d.node ?? '', (d.state ?? {}) as Partial<AgentInvokeResponse>);
          break;
        }
        case 'final':
          final = (data as { response?: AgentInvokeResponse }).response ?? null;
          break;
        case 'error':
          handlers.onError?.((data as { message?: string }).message ?? 'Unknown stream error');
          break;
        default:
          break;
      }
    };

    try {
      while (true) {
        if (handlers.signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError');
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        // Frames are separated by \n\n
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (frame.trim()) parseFrame(frame);
        }
      }

      if (final) return final;
      // If the stream closed without a `final` event, build a minimal response from
      // whatever the caller accumulated — surface as an error so the UI can react.
      throw new Error('Agent stream closed without a final response.');
    } finally {
      handlers.signal?.removeEventListener('abort', onAbort);
    }
  }

  // --- Provider ---

  async getProviderModels(): Promise<ModelInfo[]> {
    return this.request<ModelInfo[]>('/provider/models');
  }

  async getProviderHealth(): Promise<ProviderHealth> {
    return this.request<ProviderHealth>('/provider/health');
  }

  async providerChat(body: ProviderChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('/provider/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // --- WebSocket ---

  public connectWebSocket(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isExplicitClosed = false;

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    try {
      this.ws = new WebSocket(`${WS_BASE_URL}/events/ws`);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.setConnected(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const parsedEvent: KernelEvent = JSON.parse(event.data);
          this.eventHistory.push(parsedEvent);
          if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
          }
          this.wsListeners.forEach((listener) => {
            try {
              listener(parsedEvent);
            } catch (err) {
              console.error('Error executing event subscriber callback:', err);
            }
          });
        } catch (err) {
          console.error('Failed to parse WebSocket message data:', err);
        }
      };

      this.ws.onclose = () => {
        this.setConnected(false);
        if (!this.isExplicitClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket connection encountered an error:', err);
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch (err) {
      console.error('Exception trying to open WebSocket connection:', err);
      this.setConnected(false);
      this.scheduleReconnect();
    }
  }

  public disconnectWebSocket(): void {
    this.isExplicitClosed = true;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnected(false);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) return;
    this.reconnectAttempts++;
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.connectWebSocket();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  public subscribe(listener: (event: KernelEvent) => void): () => void {
    this.wsListeners.add(listener);
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connectWebSocket();
    }
    return () => {
      this.wsListeners.delete(listener);
      if (this.wsListeners.size === 0 && this.connectionListeners.size === 0) {
        this.disconnectWebSocket();
      }
    };
  }

  public onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    listener(this.connected);
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connectWebSocket();
    }
    return () => {
      this.connectionListeners.delete(listener);
      if (this.wsListeners.size === 0 && this.connectionListeners.size === 0) {
        this.disconnectWebSocket();
      }
    };
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public sendSubscribeChannel(eventType: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'subscribe', event_type: eventType }));
    }
  }

  public sendUnsubscribeChannel(eventType: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'unsubscribe', event_type: eventType }));
    }
  }

  public getEventHistory(): KernelEvent[] {
    return [...this.eventHistory];
  }

  public clearEventHistory(): void {
    this.eventHistory = [];
  }
}

export const api = new PrismApiClient();
