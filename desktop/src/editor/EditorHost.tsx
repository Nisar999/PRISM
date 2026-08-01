import { useEffect, useMemo, useRef, useState } from 'react';
import { vscodeWorkspaceAdapter, type AdapterSnapshot } from './vscodeWorkspaceAdapter';
import { cn } from '@/lib/utils';

interface EditorHostProps {
  className?: string;
  /** Optional workspace folder URI to open once the engine is ready. */
  workspaceUri?: string | null;
  /** Optional file to open once ready. */
  initialFile?: { uri: string; content?: string; language?: string; title?: string } | null;
}

/**
 * Hosts the Code-OSS editing engine inside PRISM Desktop via the existing iframe host.
 * Speaks only through vscodeWorkspaceAdapter — never imports VS Code modules.
 * Does not reimplement Explorer / Tabs / Terminal / Problems / Search.
 */
export function EditorHost({ className, workspaceUri, initialFile }: EditorHostProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [snap, setSnap] = useState<AdapterSnapshot>(() =>
    vscodeWorkspaceAdapter.getSnapshot(),
  );
  const openedRef = useRef<{ folder?: string; file?: string }>({});

  const hostUrl = useMemo(
    () => vscodeWorkspaceAdapter.resolveHostUrl({ folderUri: workspaceUri }),
    [workspaceUri],
  );

  useEffect(() => {
    return vscodeWorkspaceAdapter.subscribe(setSnap);
  }, []);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    openedRef.current = {};
    vscodeWorkspaceAdapter.attach(frame, { folderUri: workspaceUri });
    return () => {
      // Dispose the engine on unmount so the iframe doesn't leak a live
      // Code-OSS workbench process when the user navigates away from /editor.
      vscodeWorkspaceAdapter.disposeEngine();
    };
  }, [hostUrl, workspaceUri]);

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

  const statusLabel =
    snap.hostMode === 'code-oss-bridge'
      ? 'Proof bridge · set default host for Code-OSS web'
      : snap.lifecycle === 'error'
        ? 'Code-OSS unreachable — run scripts/code-oss-web.ps1'
        : 'Code-OSS · Explorer · Tabs · Terminal · Problems · Search';

  // statusLabel is surfaced via the global StatusBar; EditorHost renders only
  // the iframe plus transient loading/error overlays so there is exactly one
  // header region (the PRISM TitleBar) above the Code-OSS workbench.
  void statusLabel;

  return (
    <div className={cn('relative flex h-full min-h-0 flex-col', className)}>
      {(snap.lifecycle === 'loading' || snap.lifecycle === 'idle') && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-8">
          <p className="rounded-md border border-border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground">
            Launching Code-OSS workbench…
          </p>
        </div>
      )}

      {snap.lifecycle === 'error' && snap.lastError && (
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center px-4 pt-8">
          <p className="max-w-xl rounded-md border border-destructive/40 bg-card px-3 py-1.5 text-xs text-destructive">
            {snap.lastError}
          </p>
        </div>
      )}

      <iframe
        ref={iframeRef}
        title="PRISM Code-OSS editor host"
        src={hostUrl}
        className="min-h-0 w-full flex-1 border-0 bg-[#1e1e1e]"
        allow="clipboard-read; clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
