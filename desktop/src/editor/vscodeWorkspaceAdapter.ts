/**
 * Workspace Adapter — sole bridge between PRISM Desktop and the editing engine.
 * Isolates PRISM from Code-OSS / VS Code internals.
 */

import {
  ActiveEditorInfo,
  EDITOR_MSG,
  EditorEngineKind,
  EditorEnvelope,
  EditorLifecycle,
  OpenFileRequest,
  OpenWorkspaceRequest,
  isEditorEnvelope,
  makeEnvelope,
} from './protocol';

type Listener<T> = (value: T) => void;

/**
 * Sanitize engine errors for product UI — never expose localhost, ports,
 * vendor names, or script paths to end users.
 */
export function sanitizeEditorError(raw: string | null | undefined): string {
  const fallback = 'The editor could not start. Retry, or open a workspace folder again.';
  if (!raw || !raw.trim()) return fallback;
  const lower = raw.toLowerCase();
  if (
    /localhost|127\.0\.0\.1|:8080|code-oss|vscode|pwsh|scripts\/|workbench url|__code-oss/i.test(
      lower,
    )
  ) {
    return fallback;
  }
  const cleaned = raw
    .replace(/https?:\/\/[^\s)]+/gi, '')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, '')
    .trim();
  return cleaned || fallback;
}

export interface AdapterSnapshot {
  lifecycle: EditorLifecycle;
  engine: EditorEngineKind | null;
  engineVersion: string | null;
  workspaceUri: string | null;
  activeEditor: ActiveEditorInfo | null;
  lastError: string | null;
  hostUrl: string;
  hostMode: 'code-oss-web' | 'code-oss-bridge';
  /** Workbench-owned surfaces (constitution). */
  capabilities: Record<string, string | boolean> | null;
}

export interface ResolveHostOptions {
  /** Folder URI passed to the host on first load (avoids double navigation). */
  folderUri?: string | null;
}

/**
 * Resolve iframe URL.
 * Default: PRISM Code-OSS web host → proxied or direct workbench (:8080).
 * Override workbench with VITE_CODE_OSS_URL / VITE_CODE_OSS_WORKBENCH_URL.
 * Set VITE_EDITOR_HOST=bridge for the proof-of-protocol host.
 *
 * Always loads through `/code-oss-host/` (or the bridge) so the protocol
 * adapter receives READY/ERROR — never point the iframe at a raw workbench.
 */
export function resolveEditorHostUrl(options?: ResolveHostOptions): string {
  const mode = (import.meta.env.VITE_EDITOR_HOST as string | undefined)?.trim().toLowerCase();
  if (mode === 'bridge') {
    return `${window.location.origin}/code-oss-bridge/index.html`;
  }

  // Prefer an explicit workbench URL; fall back to the Vite proxy (dev) or
  // the local Code-OSS port (packaged). VITE_CODE_OSS_URL is treated as the
  // workbench target (not the iframe src) so the protocol host stays in the
  // middle and can still post READY/ERROR.
  const workbench = (
    (import.meta.env.VITE_CODE_OSS_WORKBENCH_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_CODE_OSS_URL as string | undefined)?.trim() ||
    (import.meta.env.DEV
      ? `${window.location.origin}/__code-oss/`
      : 'http://localhost:8080/')
  );
  const host = new URL(`${window.location.origin}/code-oss-host/index.html`);
  host.searchParams.set('workbench', workbench);
  if (options?.folderUri) {
    host.searchParams.set('folder', options.folderUri);
  }
  return host.toString();
}

function detectHostMode(url: string): 'code-oss-web' | 'code-oss-bridge' {
  if (url.includes('/code-oss-bridge/')) return 'code-oss-bridge';
  return 'code-oss-web';
}

class VscodeWorkspaceAdapter {
  private frame: HTMLIFrameElement | null = null;
  private targetOrigin = '*';
  private lifecycle: EditorLifecycle = 'idle';
  private engine: EditorEngineKind | null = null;
  private engineVersion: string | null = null;
  private workspaceUri: string | null = null;
  private activeEditor: ActiveEditorInfo | null = null;
  private lastError: string | null = null;
  private capabilities: Record<string, string | boolean> | null = null;
  private hostUrl = '';
  private pendingFolderUri: string | null = null;
  private readyWaiters: Array<(ok: boolean) => void> = [];
  private listeners = new Set<Listener<AdapterSnapshot>>();
  private boundOnMessage = (ev: MessageEvent) => this.onMessage(ev);
  /** Cached for useSyncExternalStore — referentially stable between emits. */
  private snapshot: AdapterSnapshot | null = null;
  /** Fails the lifecycle if the engine never reports ready after attach. */
  private loadWatchdog: number | null = null;

  /** Resolve the iframe URL (env override, Code-OSS host, or bridge). */
  resolveHostUrl(options?: ResolveHostOptions): string {
    const folder = options?.folderUri ?? this.pendingFolderUri ?? this.workspaceUri;
    this.hostUrl = resolveEditorHostUrl({ folderUri: folder });
    return this.hostUrl;
  }

  getSnapshot(): AdapterSnapshot {
    if (!this.snapshot) this.snapshot = this.buildSnapshot();
    return this.snapshot;
  }

  private buildSnapshot(): AdapterSnapshot {
    const hostUrl = this.hostUrl || this.resolveHostUrl();
    return {
      lifecycle: this.lifecycle,
      engine: this.engine,
      engineVersion: this.engineVersion,
      workspaceUri: this.workspaceUri,
      activeEditor: this.activeEditor,
      lastError: this.lastError,
      hostUrl,
      hostMode: detectHostMode(hostUrl),
      capabilities: this.capabilities,
    };
  }

  subscribe(listener: Listener<AdapterSnapshot>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Attach the host iframe. Call once from EditorHost after mount.
   */
  attach(frame: HTMLIFrameElement, options?: ResolveHostOptions): void {
    this.detach();
    this.frame = frame;
    if (options?.folderUri) this.pendingFolderUri = options.folderUri;
    this.lastError = null;
    this.setLifecycle('loading');
    this.hostUrl = this.resolveHostUrl(options);
    window.addEventListener('message', this.boundOnMessage);
    this.armLoadWatchdog();
  }

  detach(): void {
    this.clearLoadWatchdog();
    window.removeEventListener('message', this.boundOnMessage);
    this.frame = null;
    if (this.lifecycle !== 'disposed') {
      this.setLifecycle('idle');
    }
    this.flushReadyWaiters(false);
  }

  /** Surface a lifecycle error if the engine never reports ready. */
  private armLoadWatchdog(timeoutMs = 45_000): void {
    this.clearLoadWatchdog();
    this.loadWatchdog = window.setTimeout(() => {
      this.loadWatchdog = null;
      if (this.lifecycle !== 'loading') return;
      this.lastError = sanitizeEditorError(
        'The editing engine did not report ready in time. Retry to open the IDE.',
      );
      this.setLifecycle('error');
      this.flushReadyWaiters(false);
    }, timeoutMs);
  }

  private clearLoadWatchdog(): void {
    if (this.loadWatchdog !== null) {
      window.clearTimeout(this.loadWatchdog);
      this.loadWatchdog = null;
    }
  }

  /**
   * Wait until the hosted engine reports ready (or timeout).
   */
  waitUntilReady(timeoutMs = 30_000): Promise<boolean> {
    if (this.lifecycle === 'ready') return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.readyWaiters = this.readyWaiters.filter((w) => w !== onReady);
        resolve(false);
      }, timeoutMs);
      const onReady = (ok: boolean) => {
        window.clearTimeout(timer);
        resolve(ok);
      };
      this.readyWaiters.push(onReady);
    });
  }

  async openWorkspace(req: OpenWorkspaceRequest): Promise<void> {
    this.pendingFolderUri = req.folderUri;
    this.workspaceUri = req.folderUri;
    await this.ensureReady();
    this.post(makeEnvelope(EDITOR_MSG.OPEN_WORKSPACE, req));
    this.emit();
  }

  async openFile(req: OpenFileRequest): Promise<void> {
    await this.ensureReady();
    this.post(makeEnvelope(EDITOR_MSG.OPEN_FILE, req));
  }

  focus(): void {
    this.post(makeEnvelope(EDITOR_MSG.FOCUS));
    this.frame?.focus();
  }

  disposeEngine(): void {
    this.post(makeEnvelope(EDITOR_MSG.DISPOSE));
    this.setLifecycle('disposed');
    this.detach();
  }

  ping(): void {
    this.post(makeEnvelope(EDITOR_MSG.PING));
  }

  private async ensureReady(): Promise<void> {
    if (this.lifecycle === 'ready') return;
    const ok = await this.waitUntilReady();
    if (!ok) {
      throw new Error('Editing engine not ready');
    }
  }

  private post(envelope: EditorEnvelope): void {
    const win = this.frame?.contentWindow;
    if (!win) return;
    win.postMessage(envelope, this.targetOrigin);
  }

  private onMessage(ev: MessageEvent): void {
    if (this.frame && ev.source && ev.source !== this.frame.contentWindow) {
      return;
    }
    if (!isEditorEnvelope(ev.data)) return;

    const { type, payload } = ev.data;
    switch (type) {
      case EDITOR_MSG.READY: {
        const p = payload as
          | {
              engine?: EditorEngineKind;
              version?: string;
              capabilities?: Record<string, string | boolean>;
            }
          | undefined;
        this.clearLoadWatchdog();
        this.engine = p?.engine ?? 'code-oss-web';
        this.engineVersion = p?.version ?? null;
        this.capabilities = p?.capabilities ?? null;
        this.lastError = null;
        this.setLifecycle('ready');
        this.flushReadyWaiters(true);
        break;
      }
      case EDITOR_MSG.PONG:
        break;
      case EDITOR_MSG.ACTIVE_EDITOR: {
        this.activeEditor = (payload as ActiveEditorInfo) ?? null;
        this.emit();
        break;
      }
      case EDITOR_MSG.WORKSPACE_OPENED: {
        const p = payload as { folderUri?: string } | undefined;
        if (p?.folderUri) this.workspaceUri = p.folderUri;
        this.emit();
        break;
      }
      case EDITOR_MSG.ERROR: {
        const p = payload as { message?: string } | undefined;
        this.clearLoadWatchdog();
        this.lastError = sanitizeEditorError(p?.message ?? 'Unknown editor error');
        this.setLifecycle('error');
        this.flushReadyWaiters(false);
        break;
      }
      default:
        break;
    }
  }

  private setLifecycle(next: EditorLifecycle): void {
    this.lifecycle = next;
    this.emit();
  }

  private flushReadyWaiters(ok: boolean): void {
    const waiters = this.readyWaiters.splice(0);
    for (const w of waiters) w(ok);
  }

  private emit(): void {
    this.snapshot = this.buildSnapshot();
    const snap = this.snapshot;
    for (const l of this.listeners) l(snap);
  }
}

/** Process-wide singleton — PRISM's only editor bridge. */
export const vscodeWorkspaceAdapter = new VscodeWorkspaceAdapter();
