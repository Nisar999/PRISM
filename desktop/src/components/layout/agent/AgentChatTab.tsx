import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConversationTurnCard } from '@/components/workspace/ConversationTurnCard';
import { LoadingState } from '@/components/brand/LoadingState';
import { useWorkspace } from '@/lib/store';
import { useProviders } from '@/lib/providers';
import {
  type ConversationTurn,
  loadConversationHistory,
  runConversationTurn,
} from '@/lib/workflows/conversation';
import { shellUiStore } from '@/lib/shellUi';
import { commands } from '@/lib/commands';

/**
 * Agent panel Chat tab — same conversation artifact + runConversationTurn as `/conversation`.
 * No parallel chat store.
 */
export function AgentChatTab() {
  const workspace = useWorkspace();
  const providers = useProviders();
  const navigate = useNavigate();
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeProvider = providers.activeProviderId
    ? providers.providers[providers.activeProviderId]
    : null;
  const modelLabel =
    activeProvider?.models?.[0] ?? activeProvider?.name ?? 'No provider';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const history = await loadConversationHistory();
      if (!cancelled) setTurns(history);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace.activeProject?.id, workspace.activeSessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || busy || !workspace.activeProject) return;
    const text = draft.trim();
    setDraft('');
    setBusy(true);
    setError(null);
    const optimistic: ConversationTurn = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setTurns((t) => [...t, optimistic]);
    try {
      const result = await runConversationTurn(text, turns);
      setTurns(result.turns);
      shellUiStore.setRightTab('thoughts');
      if (result.intent === 'code_mod') navigate('/review');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setTurns((t) => t.filter((x) => x.id !== optimistic.id));
      setDraft(text);
    } finally {
      setBusy(false);
    }
  };

  if (!workspace.activeProject) {
    return (
      <div className="space-y-2 p-1 text-xs text-prism-meta">
        <p className="font-mono text-[10px] uppercase tracking-wider text-prism-dim">Chat</p>
        <p>Open a workspace so conversation history can bind to a session.</p>
        <button
          type="button"
          className="rounded-control border border-prism-border px-2 py-1 text-white hover:bg-prism-soft"
          onClick={() => {
            void commands.execute('workspace:open');
          }}
        >
          Open Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-prism-dim">
          Session chat · {modelLabel}
        </p>
        {turns.length === 0 && !busy ? (
          <p className="text-xs text-prism-dim">
            Ask PRISM here or in Conversation — history is the same session artifact.
          </p>
        ) : null}
        {turns.map((turn) => (
          <ConversationTurnCard key={turn.id} turn={turn} className="ml-0 mr-0 sm:ml-0 sm:mr-0 p-2.5 text-xs" />
        ))}
        {busy ? <LoadingState kind="milly" className="py-4" showElement={false} /> : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={(e) => void submit(e)} className="mt-2 shrink-0 border-t border-prism-subtle pt-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          disabled={busy}
          rows={3}
          placeholder="Ask anything…"
          className="w-full resize-none rounded-control border border-prism-border bg-prism-soft px-2.5 py-2 text-xs text-white outline-none placeholder:text-prism-dim focus:border-prism-focus/40"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="mt-1.5 w-full rounded-control bg-prism-fill py-1.5 text-xs font-semibold text-white hover:bg-prism-soft disabled:opacity-40"
        >
          {busy ? 'Thinking…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
