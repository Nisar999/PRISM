import { useEffect } from 'react';
import { useWorkspace, workspaceStore } from '@/lib/store';
import { useMemory, memoryManager } from '@/lib/memory';
import { EmptyState } from '@/components/brand/EmptyState';
import { LoadingState } from '@/components/brand/LoadingState';

/**
 * Globe View (ADR-006) — spatial / project context in the main workspace.
 * Opens as a center editor tab via Milly Workspace Menu.
 */
export function GlobeViewPage() {
  const workspace = useWorkspace();
  const memory = useMemory();

  useEffect(() => {
    workspaceStore.openPane('globe');
  }, []);

  useEffect(() => {
    const q = workspace.activeProject
      ? `${workspace.activeProject.name} project workspace`
      : 'workspace projects';
    void memoryManager.search({ query: q, limit: 12 });
  }, [workspace.activeProject?.id, workspace.activeProject?.name]);

  const projects = workspace.projects;

  return (
    <div className="h-full overflow-auto p-6 md:p-8">
      <header className="mb-6 max-w-3xl">
        <h1 className="font-afacad text-2xl font-semibold uppercase tracking-wide text-white">
          Globe View
        </h1>
        <p className="mt-1 text-sm text-prism-meta">
          Workspace projects and related memory — live WorkspaceManager + Memory engine data.
        </p>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          variant="milly"
          title="No projects loaded"
          description="Open a workspace so Globe View can place projects in context."
          actionLabel="Open Workspace"
          actionTo="/workspace"
        />
      ) : (
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          {projects.map((p) => {
            const active = workspace.activeProject?.id === p.id;
            return (
              <article
                key={p.id}
                className={
                  active
                    ? 'rounded-control border border-prism-focus/40 bg-prism-panel p-4'
                    : 'rounded-control border border-white/[0.08] bg-prism-panel/80 p-4'
                }
              >
                <h2 className="font-manrope text-sm font-semibold text-white">{p.name}</h2>
                <p className="mt-1 truncate font-mono text-[11px] text-prism-meta">{p.path}</p>
                {p.tags.length > 0 ? (
                  <p className="mt-2 text-[11px] text-prism-dim">{p.tags.join(' · ')}</p>
                ) : null}
                {active ? (
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-prism-cyan">Active</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <section className="mx-auto mt-8 max-w-4xl">
        <h3 className="mb-3 font-manrope text-xs font-semibold uppercase tracking-wide text-prism-meta">
          Related memory
        </h3>
        {memory.status === 'loading' ? <LoadingState kind="milly" /> : null}
        {memory.lastResults.length === 0 && memory.status !== 'loading' ? (
          <p className="text-sm text-prism-dim">No related memories for the active project.</p>
        ) : (
          <ul className="space-y-2">
            {memory.lastResults.slice(0, 8).map((hit) => (
              <li
                key={hit.memory.id}
                className="rounded-control border border-white/[0.06] bg-black/20 px-3 py-2 text-sm text-white/80"
              >
                <span className="mr-2 font-mono text-[10px] uppercase text-prism-meta">
                  {hit.memory.memory_type}
                </span>
                {hit.memory.content.slice(0, 180)}
                {hit.memory.content.length > 180 ? '…' : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
