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
import { agentManager } from '@/lib/agent';
import { notificationStore } from '@/lib/store';
import { settingsManager, useSettings } from '@/lib/settings';
import { millyEngine } from '@/lib/milly';
import { voiceManager } from '@/lib/voice';

/**
 * First-class Conversation surface — Desktop-2 hub presentation (Figma 478:284).
 * Workflow + stores unchanged; ChatHub is presentation only. Chat responses
 * stream live from the backend agent graph (SSE) — the PRISM turn content
 * updates in place as each node publishes state.
 */
export function ConversationPage() {
  const workspace = useWorkspace();
  const providers = useProviders();
  const settings = useSettings();
  const navigate = useNavigate();
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const providerList = Object.values(providers.providers);
  const activeProvider = providers.activeProviderId
    ? providers.providers[providers.activeProviderId]
    : null;
  const modelLabel =
    settings.providers.preferredModel ||
    activeProvider?.models?.[0] ||
    activeProvider?.name ||
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

  const cancelTurn = () => {
    abortRef.current?.abort();
    agentManager.cancel();
    voiceManager.cancel();
    millyEngine.clearOverride();
    setBusy(false);
  };

  const runTurn = async (text: string, prior: ConversationTurn[]) => {
    setBusy(true);
    setError(null);
    setLastFailedMessage(null);
    const controller = new AbortController();
    abortRef.current = controller;
    millyEngine.signalListening(false);

    const optimistic: ConversationTurn = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setTurns([...prior, optimistic]);

    try {
      const result = await runConversationTurnStream(text, prior, {
        signal: controller.signal,
        onPrismStart: (turn) => {
          setTurns((t) => [...t, turn]);
        },
        onPrismUpdate: (turn) => {
          setTurns((t) => t.map((x) => (x.id === turn.id ? { ...turn } : x)));
        },
        onPrismFinal: (turn) => {
          setTurns((t) => t.map((x) => (x.id === turn.id ? { ...turn } : x)));
        },
      });
      setTurns(result.turns);
      if (result.intent === 'code_mod') {
        navigate('/review');
      }
    } catch (err) {
      const aborted =
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && /abort|cancel/i.test(err.message));
      if (aborted) {
        setError(null);
        setDraft(text);
        setTurns(prior);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLastFailedMessage(text);
      setTurns(prior);
      setDraft(text);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  };

  const submitTurn = async () => {
    if (!draft.trim() || busy) return;
    const text = draft.trim();
    setDraft('');
    await runTurn(text, turns);
  };

  const retryLast = async () => {
    if (busy || !lastFailedMessage) return;
    setDraft('');
    await runTurn(lastFailedMessage, turns);
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
      onDraftChange={(v) => {
        setDraft(v);
        millyEngine.signalListening(v.trim().length > 0 && !busy);
      }}
      onSubmit={() => void onSubmit()}
      busy={busy}
      error={error}
      onCancel={busy ? cancelTurn : undefined}
      onRetry={lastFailedMessage && !busy ? () => void retryLast() : undefined}
      modelLabel={modelLabel}
      onModelClick={() => navigate('/settings?tab=providers')}
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
          description: 'Speech-to-text is reserved for a later milestone. Enable TTS in Settings → Milly.',
        });
        void navigate('/settings?tab=milly');
      }}
    />
  );
}
