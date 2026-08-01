import { useEffect } from 'react';
import { useMemory, memoryManager } from '@/lib/memory';
import { useWorkspace, workspaceStore } from '@/lib/store';
import { EmptyState } from '@/components/brand/EmptyState';
import { LoadingState } from '@/components/brand/LoadingState';

/**
 * PRISM View (ADR-005) — memory transparency in the main workspace.
 * Opens as a center editor tab via Milly Workspace Menu.
 */
export function PrismViewPage() {
  const memory = useMemory();
  const workspace = useWorkspace();

  useEffect(() => {
    workspaceStore.openPane('prism');
  }, []);

  useEffect(() => {
    const name = workspace.activeProject?.name ?? 'PRISM';
    void memoryManager.search({ query: `${name} memory trust timeline`, limit: 24 });
  }, [workspace.activeProject?.id, workspace.activeProject?.name]);

  return (
    <div className="h-full overflow-auto p-6 md:p-8">
      <header className="mb-6 max-w-3xl">
        <h1 className="font-afacad text-2xl font-semibold uppercase tracking-wide text-white">
          PRISM View
        </h1>
        <p className="mt-1 text-sm text-prism-meta">
          Memory types, trust, and retrieval — backed by the Memory engine (no local mock).
        </p>
      </header>

      {memory.status === 'loading' ? <LoadingState kind="milly" /> : null}

      {memory.status === 'error' ? (
        <EmptyState
          variant="milly"
          title="Memory unreachable"
          description={memory.error ?? 'Start the PRISM backend to populate PRISM View.'}
        />
      ) : null}

      {memory.status === 'ready' && memory.lastResults.length === 0 ? (
        <EmptyState
          variant="milly"
          title="No memories yet"
          description="Ask in Conversation or store memories — this view reflects backend Memory records only."
          actionLabel="Open Conversation"
          actionTo="/conversation"
        />
      ) : null}

      {memory.lastResults.length > 0 ? (
        <ul className="mx-auto max-w-3xl space-y-3">
          {memory.lastResults.map((hit) => (
            <li
              key={hit.memory.id}
              className="rounded-control border border-white/[0.08] bg-prism-panel/80 px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-prism-meta">
                <span className="uppercase text-prism-cyan">{hit.memory.memory_type}</span>
                <span>·</span>
                <span>trust {(hit.memory.trust ?? 0).toFixed(2)}</span>
                <span>·</span>
                <span>rel {hit.relevance_score.toFixed(2)}</span>
              </div>
              <p className="mt-2 text-sm text-white/90 whitespace-pre-wrap">
                {hit.memory.content}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
