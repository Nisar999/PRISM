import { useWorkspace, useExecution } from '@/lib/store';
import { useProviders } from '@/lib/providers';
import { useAgent } from '@/lib/agent';
import { shellUiStore } from '@/lib/shellUi';
import { GraphCanvas } from '@/components/GraphCanvas';

/**
 * Agent panel Context tab — live workspace + provider + execution graph.
 * Reuses existing stores / GraphCanvas; no duplicated context state.
 */
export function AgentContextTab() {
  const workspace = useWorkspace();
  const execution = useExecution();
  const providers = useProviders();
  const agent = useAgent();

  const activeProvider = providers.activeProviderId
    ? providers.providers[providers.activeProviderId]
    : null;

  const taskCount = Object.values(execution.tasks).length;
  const recent = [...execution.events].slice(-6).reverse();

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-prism-dim">
        Context · live stores
      </p>

      <dl className="grid grid-cols-1 gap-2 text-xs">
        <div className="rounded-md border border-prism-border bg-prism-soft p-2">
          <dt className="text-prism-meta">Project</dt>
          <dd className="font-medium text-white">
            {workspace.activeProject?.name ?? 'None'}
          </dd>
          {workspace.activeProject?.path ? (
            <dd className="mt-0.5 truncate font-mono text-[10px] text-prism-dim">
              {workspace.activeProject.path}
            </dd>
          ) : null}
        </div>
        <div className="rounded-md border border-prism-border bg-prism-soft p-2">
          <dt className="text-prism-meta">Session</dt>
          <dd className="font-mono text-[11px] text-white">
            {workspace.activeSessionId ?? 'None'}
          </dd>
        </div>
        <div className="rounded-md border border-prism-border bg-prism-soft p-2">
          <dt className="text-prism-meta">Provider</dt>
          <dd className="text-white">
            {activeProvider?.name ?? 'None'}
            {activeProvider?.models?.[0] ? (
              <span className="text-prism-meta"> · {activeProvider.models[0]}</span>
            ) : null}
          </dd>
        </div>
        <div className="rounded-md border border-prism-border bg-prism-soft p-2">
          <dt className="text-prism-meta">Execution</dt>
          <dd className="text-white">
            {execution.pipelineState}
            <span className="text-prism-meta">
              {' '}
              · {taskCount} task(s)
              {agent.status !== 'idle' ? ` · agent ${agent.status}` : ''}
            </span>
          </dd>
        </div>
      </dl>

      <div className="min-h-[140px] flex-1 overflow-hidden rounded-md border border-prism-border">
        <div className="flex items-center justify-between border-b border-prism-subtle px-2 py-1">
          <span className="font-mono text-[10px] uppercase text-prism-dim">Execution graph</span>
          <button
            type="button"
            className="text-[10px] text-prism-cyan hover:underline"
            onClick={() => shellUiStore.setBottomTab('graph')}
          >
            Expand dock
          </button>
        </div>
        <div className="h-[160px] w-full">
          <GraphCanvas />
        </div>
      </div>

      {recent.length > 0 ? (
        <ul className="space-y-1 font-mono text-[10px]">
          {recent.map((ev, i) => (
            <li key={`${ev.id}-${i}`} className="truncate text-prism-meta">
              <span className="text-white/70">{ev.event_type}</span>
              {ev.message ? ` · ${ev.message}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
