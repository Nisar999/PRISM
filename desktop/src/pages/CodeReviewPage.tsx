import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, FileCode2, RotateCcw, X } from 'lucide-react';
import { EmptyState } from '@/components/brand/EmptyState';
import { codeReviewStore, useCodeReview } from '@/lib/codeReviewStore';
import {
  acceptCodeModifications,
  rejectCodeModifications,
  rollbackLastCodeModification,
} from '@/lib/workflows/codeModification';
import { cn } from '@/lib/utils';

/**
 * Code Review panel — unified diffs must be accepted before any project write.
 */
export function CodeReviewPanel({ compact = false }: { compact?: boolean }) {
  const { activeProposal, lastProposal } = useCodeReview();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const files = activeProposal?.files ?? [];
  const activePath = selected && files.some((f) => f.relativePath === selected)
    ? selected
    : files[0]?.relativePath ?? null;
  const activeFile = files.find((f) => f.relativePath === activePath) ?? null;

  const totals = useMemo(
    () =>
      files.reduce(
        (a, f) => ({ add: a.add + f.additions, del: a.del + f.deletions }),
        { add: 0, del: 0 },
      ),
    [files],
  );

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!activeProposal) {
    return (
      <div className={cn('h-full', compact ? 'p-2' : 'p-4')}>
        <EmptyState
          variant="element"
          title="No pending review"
          description={
            lastProposal
              ? `Last decision: ${lastProposal.decision}. Ask PRISM to edit code from Conversation to propose a new diff.`
              : 'Ask PRISM to modify code from Conversation. Diffs appear here for Accept / Reject before any write.'
          }
          actionLabel="Open Conversation"
          actionTo="/conversation"
          className={compact ? 'border-0 shadow-none' : undefined}
        />
        {lastProposal?.decision === 'accepted' && lastProposal.appliedSnapshots && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => rollbackLastCodeModification())}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rollback last apply
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('h-full flex flex-col min-h-0', compact ? '' : 'prism-enter-fast')}>
      {!compact && (
        <header className="shrink-0 mb-3 space-y-1 px-1">
          <h1 className="text-2xl font-bold tracking-tight">Code Review</h1>
          <p className="text-sm text-muted-foreground">
            Unified diffs · transactional apply · nothing writes until you accept
          </p>
          <p className="text-[11px] text-muted-foreground">
            {activeProposal.source} · {files.length} file(s) · +{totals.add}/−{totals.del} ·{' '}
            <Link to="/conversation" className="underline underline-offset-2 hover:text-foreground">
              Conversation
            </Link>
            {' · '}
            <Link to="/execution" className="underline underline-offset-2 hover:text-foreground">
              Execution
            </Link>
          </p>
        </header>
      )}

      {compact && (
        <div className="shrink-0 px-2 py-1 text-[11px] text-muted-foreground border-b border-border flex items-center gap-2">
          <span className="font-mono">
            {activeProposal.source} · {files.length} file(s) · +{totals.add}/−{totals.del}
          </span>
        </div>
      )}

      <p className={cn('text-xs text-muted-foreground shrink-0', compact ? 'px-2 py-1' : 'mb-2 px-1')}>
        {activeProposal.planSummary.slice(0, compact ? 160 : 400)}
        {activeProposal.planSummary.length > (compact ? 160 : 400) ? '…' : ''}
      </p>

      <div className="flex gap-2 shrink-0 px-2 pb-2 flex-wrap">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => acceptCodeModifications())}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          Accept All
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => rejectCodeModifications())}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          Reject All
        </button>
        {activeFile && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                codeReviewStore.acceptFile(activeFile.relativePath);
                await acceptCodeModifications({ onlyPaths: [activeFile.relativePath] });
              })
            }
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary disabled:opacity-50"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            Accept file
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive px-2 pb-2 shrink-0">{error}</p>
      )}

      <div className="flex-1 min-h-0 flex border-t border-border">
        <aside className="w-44 shrink-0 border-r border-border overflow-y-auto">
          {files.map((f) => (
            <button
              key={f.relativePath}
              type="button"
              onClick={() => setSelected(f.relativePath)}
              className={cn(
                'w-full text-left px-2 py-1.5 text-[11px] border-b border-border/60',
                activePath === f.relativePath
                  ? 'bg-secondary text-secondary-foreground'
                  : 'hover:bg-secondary/40 text-muted-foreground',
              )}
            >
              <div className="font-mono truncate">{f.relativePath}</div>
              <div className="text-[10px]">
                <span className="text-emerald-600 dark:text-emerald-400">+{f.additions}</span>
                {' / '}
                <span className="text-rose-600 dark:text-rose-400">−{f.deletions}</span>
                {f.isNew ? ' · new' : ''}
                {f.status !== 'pending' ? ` · ${f.status}` : ''}
              </div>
            </button>
          ))}
        </aside>
        <pre className="flex-1 min-w-0 overflow-auto p-2 font-mono text-[11px] leading-relaxed bg-background">
          {activeFile
            ? activeFile.unifiedDiff.split('\n').map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    line.startsWith('+') && !line.startsWith('+++') && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                    line.startsWith('-') && !line.startsWith('---') && 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
                    (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) &&
                      'text-muted-foreground',
                  )}
                >
                  {line || ' '}
                </div>
              ))
            : null}
        </pre>
      </div>
    </div>
  );
}
