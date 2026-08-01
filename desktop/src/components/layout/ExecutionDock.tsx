import { PanelTabs } from '@/components/ui/PanelTabs';
import { IconButton } from '@/components/ui/IconButton';
import { shellUiStore, useShellUi } from '@/lib/shellUi';
import { useExecution } from '@/lib/store';
import { GraphCanvas } from '../GraphCanvas';
import { CodeReviewPanel } from '@/pages/CodeReviewPage';
import { useCodeReview } from '@/lib/codeReviewStore';
import { X } from 'lucide-react';

export function ExecutionDock() {
  const shell = useShellUi();
  const execution = useExecution();
  const review = useCodeReview();

  const events = [...execution.events].slice(-40).reverse();
  const pending = review.activeProposal?.files.length ?? 0;

  const tabs = [
    { id: 'graph' as const, label: 'Execution Graph' },
    { id: 'output' as const, label: 'Output' },
    {
      id: 'review' as const,
      label: pending ? `Code Review (${pending})` : 'Code Review',
    },
  ];

  return (
    <section className="flex h-full w-full shrink-0 flex-col overflow-hidden bg-prism-panel">
      <PanelTabs
        tabs={tabs}
        active={shell.bottomTab}
        onChange={(id) => shellUiStore.setBottomTab(id)}
        trailing={
          <>
            <span className="ml-2 truncate font-mono text-[10px] text-prism-dim">
              {execution.pipelineState}
              {execution.activeSessionId ? ` · ${execution.activeSessionId.slice(0, 8)}` : ''}
            </span>
            <IconButton
              className="ml-auto p-1"
              title="Close dock"
              onClick={() => shellUiStore.toggleBottom()}
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        {shell.bottomTab === 'graph' ? (
          <div className="h-full w-full">
            <GraphCanvas />
          </div>
        ) : shell.bottomTab === 'review' ? (
          <CodeReviewPanel compact />
        ) : (
          <div className="h-full space-y-1 overflow-y-auto p-2 font-mono text-[11px]">
            {events.length === 0 ? (
              <p className="p-2 text-prism-dim">
                No execution events yet. Runtime events arrive over WebSocket; agent invoke updates
                pipeline state via HTTP.
              </p>
            ) : (
              events.map((ev, i) => (
                <div key={`${ev.id}-${i}`} className="border-b border-prism-subtle px-1 py-1">
                  <span className="text-prism-meta">{ev.event_type}</span>
                  {ev.message ? <span className="ml-2 text-white/80">{ev.message}</span> : null}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
