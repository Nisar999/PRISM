import { useWorkspace } from '@/lib/store';
import { commands } from '@/lib/commands';

/**
 * Workspace surface — project/session status.
 * Explorer lives in the shell Sidebar (Figma 434:2); do not duplicate it here.
 */
export function WorkspacePage() {
  const workspace = useWorkspace();

  return (
    <div className="h-full space-y-4 overflow-auto p-4 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Project / Session / Artifact hierarchy · use the Explorer sidebar
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95"
          onClick={() => {
            void commands.execute('workspace:open');
          }}
        >
          Open Workspace
        </button>
      </header>

      <div className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
        <p>
          Active project:{' '}
          <span className="font-mono">{workspace.activeProject?.name ?? 'none'}</span>
        </p>
        <p>
          Path:{' '}
          <span className="font-mono text-xs">{workspace.activeProject?.path ?? '—'}</span>
        </p>
        <p>
          Active session:{' '}
          <span className="font-mono">{workspace.activeSessionId ?? 'none'}</span>
        </p>
        <p>
          Projects loaded: <span className="font-mono">{workspace.projects.length}</span>
        </p>
      </div>
    </div>
  );
}
