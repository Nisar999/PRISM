import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EditorHost } from '@/editor';
import { useWorkspace } from '@/lib/store';

/**
 * Code-OSS insertion point — full-bleed editing engine.
 * Explorer / Tabs / Terminal / Problems / Search live inside Code-OSS (constitution).
 * PRISM only supplies workspace URI + adapter bridge; no duplicate editor chrome.
 */
export function EditorPage() {
  const workspace = useWorkspace();
  const [params] = useSearchParams();
  const [opening, setOpening] = useState(false);

  const workspaceUri = useMemo(() => {
    const fromQuery = params.get('folder');
    if (fromQuery) return fromQuery;
    const proj = workspace.activeProject;
    if (!proj) return null;
    return `file:///${proj.path.replace(/\\/g, '/')}`;
  }, [params, workspace.activeProject]);

  const initialFile = useMemo(() => {
    const uri = params.get('uri');
    if (!uri) return null;
    return {
      uri,
      content: params.get('content') ?? undefined,
      language: params.get('language') ?? undefined,
      title: params.get('title') ?? undefined,
    };
  }, [params]);

  const openWorkspace = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const { commands } = await import('@/lib/commands');
      await commands.execute('workspace:open');
    } finally {
      setOpening(false);
    }
  };

  if (!workspaceUri) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-prism-editor px-6 text-center">
        <div>
          <h1 className="font-manrope text-lg font-semibold text-white">Code-OSS editing engine</h1>
          <p className="mt-2 max-w-md font-manrope text-sm text-prism-meta">
            Open a workspace so Explorer, Tabs, Terminal, Problems, and Search load from unmodified
            Code-OSS — not a PRISM reimplementation.
          </p>
        </div>
        <button
          type="button"
          disabled={opening}
          className="rounded-control border border-prism-border bg-prism-fill px-4 py-2 font-manrope text-sm text-white hover:bg-prism-soft prism-focus-ring disabled:opacity-50"
          onClick={() => void openWorkspace()}
        >
          {opening ? 'Opening…' : 'Open Workspace & Launch Editor'}
        </button>
      </div>
    );
  }

  return (
    <EditorHost
      className="h-full border-0"
      workspaceUri={workspaceUri}
      initialFile={initialFile}
    />
  );
}
