import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { vscodeWorkspaceAdapter, type AdapterSnapshot } from './vscodeWorkspaceAdapter';
import { LoadingState } from '@/components/brand/LoadingState';
import { LOADING_COPY } from '@/lib/brand';
import { ensureEditorRuntime } from '@/lib/ensureEditorRuntime';
import { cn } from '@/lib/utils';

interface EditorHostProps {
  className?: string;
  /** Optional workspace folder URI to open once the engine is ready. */
  workspaceUri?: string | null;
  /** Optional file to open once ready. */
  initialFile?: { uri: string; content?: string; language?: string; title?: string } | null;
}

/**
 * Hosts the PRISM editing engine (internal workbench) via the Workspace Adapter.
 * Speaks only through vscodeWorkspaceAdapter — never imports workbench modules.
 * Does not reimplement Explorer / Tabs / Terminal / Problems / Search.
 */
export function EditorHost({ className, workspaceUri, initialFile }: EditorHostProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [snap, setSnap] = useState<AdapterSnapshot>(() =>
    vscodeWorkspaceAdapter.getSnapshot(),
  );
  const [retryNonce, setRetryNonce] = useState(0);
  const [ensuring, setEnsuring] = useState(true);
  const openedRef = useRef<{ folder?: string; file?: string }>({});

  const hostUrl = useMemo(
    () => vscodeWorkspaceAdapter.resolveHostUrl({ folderUri: workspaceUri }),
    [workspaceUri, retryNonce],
  );

  useEffect(() => {
    return vscodeWorkspaceAdapter.subscribe(setSnap);
  }, []);

  // Silent runtime bring-up before attaching the host iframe.
  useEffect(() => {
    let cancelled = false;
    setEnsuring(true);
    void (async () => {
      await ensureEditorRuntime();
      if (!cancelled) setEnsuring(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [retryNonce]);

  useEffect(() => {
    if (ensuring) return;
    const frame = iframeRef.current;
    if (!frame) return;
    openedRef.current = {};
    vscodeWorkspaceAdapter.attach(frame, { folderUri: workspaceUri });
    return () => {
      vscodeWorkspaceAdapter.disposeEngine();
    };
  }, [hostUrl, workspaceUri, retryNonce, ensuring]);

  useEffect(() => {
    if (snap.lifecycle !== 'ready') return;
    let cancelled = false;
    (async () => {
      try {
        if (workspaceUri && openedRef.current.folder !== workspaceUri) {
          openedRef.current.folder = workspaceUri;
          await vscodeWorkspaceAdapter.openWorkspace({ folderUri: workspaceUri });
        }
        if (initialFile && !cancelled && openedRef.current.file !== initialFile.uri) {
          openedRef.current.file = initialFile.uri;
          await vscodeWorkspaceAdapter.openFile(initialFile);
        }
      } catch {
        // Adapter surfaces lastError via snapshot.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [snap.lifecycle, workspaceUri, initialFile]);

  const loading =
    ensuring || snap.lifecycle === 'loading' || snap.lifecycle === 'idle';
  const failed = !ensuring && snap.lifecycle === 'error';

  return (
    <div className={cn('relative flex h-full min-h-0 flex-col', className)}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-prism-editor">
          <LoadingState kind="editor" message={LOADING_COPY.editor} />
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-prism-editor px-6">
          <div
            className="prism-enter-up w-full max-w-md rounded-xl border border-white/10 bg-prism-panel p-6 text-center shadow-prism-elevated"
            role="alert"
          >
            <TriangleAlert className="mx-auto size-8 text-amber-400" />
            <h2 className="mt-3 font-manrope text-[16px] font-semibold text-white">
              The editor couldn&apos;t start
            </h2>
            <p className="mt-2 break-words font-manrope text-[13px] leading-relaxed text-prism-muted">
              {snap.lastError ?? 'PRISM could not open the workspace editor. Retry, or open a folder again.'}
            </p>
            {import.meta.env.DEV ? (
              <p className="mt-1 font-manrope text-[12px] text-prism-dim">
                Dev: ensure the editing-engine sidecar is running (
                <code className="rounded bg-white/5 px-1 py-0.5">npm run dev:code-oss</code>
                ).
              </p>
            ) : null}
            <button
              type="button"
              className={cn(
                'prism-focus-ring mt-5 inline-flex items-center gap-2 rounded-control',
                'bg-prism-fill px-4 py-2 font-manrope text-[13px] font-semibold text-white',
                'transition-colors hover:bg-white/15 active:scale-[0.98]',
              )}
              onClick={() => setRetryNonce((n) => n + 1)}
            >
              <RefreshCw className="size-3.5" />
              Retry
            </button>
          </div>
        </div>
      )}

      {!ensuring ? (
        <iframe
          key={retryNonce}
          ref={iframeRef}
          title="PRISM Editor"
          src={hostUrl}
          className="min-h-0 w-full flex-1 border-0 bg-[#1e1e1e]"
          allow="clipboard-read; clipboard-write"
        />
      ) : null}
    </div>
  );
}
