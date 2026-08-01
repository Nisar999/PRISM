import { useSyncExternalStore } from 'react';
import { useKernel, useExecution, useWorkspace } from '@/lib/store';
import { useMemory } from '@/lib/memory';
import { useAgent } from '@/lib/agent';
import { useCodeReview } from '@/lib/codeReviewStore';
import { PRODUCT } from '@/lib/brand';
import { vscodeWorkspaceAdapter } from '@/editor';

/** Figma 434:2 StatusBar — 24px. Includes Code-OSS adapter live state. */
export function StatusBar() {
  const kernel = useKernel();
  const execution = useExecution();
  const workspace = useWorkspace();
  const memory = useMemory();
  const agent = useAgent();
  const review = useCodeReview();
  const editor = useSyncExternalStore(
    vscodeWorkspaceAdapter.subscribe.bind(vscodeWorkspaceAdapter),
    vscodeWorkspaceAdapter.getSnapshot.bind(vscodeWorkspaceAdapter),
  );

  const taskCount = Object.values(execution.tasks).filter(
    (t) => t.status === 'pending' || t.status === 'queued' || t.status === 'running',
  ).length;

  const pendingReview =
    review.activeProposal?.files.filter((f) => f.status === 'pending').length ?? 0;

  const runtimeLabel = kernel.isOnline
    ? execution.pipelineState === 'IDLE'
      ? agent.status === 'invoking'
        ? 'Agent Invoking'
        : 'Connected'
      : `Runtime: ${execution.pipelineState}`
    : 'Offline';

  const memoryLabel =
    memory.backendReachable === false
      ? 'Memory: Unreachable'
      : memory.status === 'loading'
        ? 'Memory: Loading'
        : memory.status === 'error'
          ? 'Memory: Error'
          : memory.status === 'ready' && memory.lastResults.length > 0
            ? `Memory: ${memory.lastResults.length} hit(s)`
            : 'Memory: OK';

  const projectLabel = workspace.activeProject
    ? workspace.activeProject.name
    : 'No folder';

  const editorLabel =
    editor.lifecycle === 'ready'
      ? editor.activeEditor?.title ?? editor.activeEditor?.uri?.split('/').pop() ?? 'Code-OSS ready'
      : editor.lifecycle === 'error'
        ? 'Code-OSS offline'
        : editor.lifecycle === 'loading'
          ? 'Code-OSS…'
          : null;

  const editorTone =
    editor.lifecycle === 'ready'
      ? 'text-emerald-400/90'
      : editor.lifecycle === 'error'
        ? 'text-destructive'
        : editor.lifecycle === 'loading' || editor.lifecycle === 'idle'
          ? 'text-amber-400/90'
          : 'text-white/60';

  return (
    <footer
      className="flex h-6 shrink-0 select-none items-center justify-between border-t border-white/[0.06] bg-prism-panel px-3 text-[11px] text-prism-meta"
      data-name="StatusBar"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-white/70">
          {PRODUCT.name} {PRODUCT.versionLabel}
        </span>
        <span>{runtimeLabel}</span>
        <span className="max-w-[200px] truncate">{projectLabel}</span>
        {editorLabel ? (
          <span className={`max-w-[220px] truncate ${editorTone}`} title={editor.lastError ?? undefined}>
            {editorLabel}
            {editor.activeEditor?.dirty ? ' •' : ''}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <span>{taskCount} tasks</span>
        {pendingReview > 0 ? <span>Review {pendingReview}</span> : null}
        <span>{memoryLabel}</span>
      </div>
    </footer>
  );
}
