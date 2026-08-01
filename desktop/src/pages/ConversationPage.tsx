import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/lib/store';
import { ChatHub } from '@/components/workspace/ChatHub';
import {
  ConversationTurn,
  loadConversationHistory,
  runConversationTurnStream,
} from '@/lib/workflows/conversation';
import { providerManager, useProviders } from '@/lib/providers';
import { commands } from '@/lib/commands';
import { notificationStore } from '@/lib/store';
import { settingsManager } from '@/lib/settings';

/**
 * First-class Conversation surface — Desktop-2 hub presentation (Figma 478:284).
 * Workflow + stores unchanged; ChatHub is presentation only. Chat responses
 * stream live from the backend agent graph (SSE) — the PRISM turn content
 * updates in place as each node publishes state.
 */
export function ConversationPage() {
  const workspace = useWorkspace();
  const providers = useProviders();
  const navigate = useNavigate();
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const providerList = Object.values(providers.providers);
  const activeProvider = providers.activeProviderId
    ? providers.providers[providers.activeProviderId]
    : null;
  const modelLabel =
    activeProvider?.models?.[0] ??
    activeProvider?.name ??
    'No provider';

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

  const submitTurn = async () => {
    if (!draft.trim() || busy) return;
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
      const result = await runConversationTurnStream(text, turns, {
        onPrismStart: (turn) => {
          setTurns((t) => [...t, turn]);
        },
        onPrismUpdate: (turn) => {
          setTurns((t) =>
            t.map((x) => (x.id === turn.id ? { ...turn } : x)),
          );
        },
        onPrismFinal: (turn) => {
          setTurns((t) =>
            t.map((x) => (x.id === turn.id ? { ...turn } : x)),
          );
        },
      });
      // Reconcile with the canonical turn list from the workflow result.
      setTurns(result.turns);
      if (result.intent === 'code_mod') {
        navigate('/review');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setTurns((t) => t.filter((x) => x.id !== optimistic.id));
      setDraft(text);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    await submitTurn();
  };

  const selectProvider = async (providerId: string) => {
    try {
      await providerManager.selectProvider(providerId, { softFail: true });
      await settingsManager.updateOption('providers', 'preferredProviderId', providerId);
    } catch (err) {
      notificationStore.addNotification({
        type: 'warning',
        message: 'Provider switch failed',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <ChatHub
      turns={turns}
      draft={draft}
      onDraftChange={setDraft}
      onSubmit={() => void onSubmit()}
      busy={busy}
      error={error}
      modelLabel={modelLabel}
      onModelClick={() => navigate('/settings')}
      providers={providerList.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
      }))}
      activeProviderId={providers.activeProviderId}
      onSelectProvider={(id) => void selectProvider(id)}
      worktreeLabel={workspace.activeProject?.name ?? 'Open Workspace'}
      branchLabel="Main"
      onWorktreeClick={() => {
        void commands.execute('workspace:open');
      }}
      onBranchClick={() => {
        notificationStore.addNotification({
          type: 'info',
          message: 'Branch context',
          description: 'Branch follows the open workspace folder.',
        });
        void commands.execute('workspace:open');
      }}
      onMicClick={() => {
        notificationStore.addNotification({
          type: 'info',
          message: 'Voice input',
          description: 'Voice is reserved for v2 ADE — type your ask in the composer.',
        });
      }}
      bottomRef={bottomRef}
    />
  );
}
