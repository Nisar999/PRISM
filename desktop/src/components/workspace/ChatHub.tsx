import { useEffect, useRef } from 'react';
import { AlertTriangle, PanelBottom, PanelRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import glowCenter from '@/assets/figma/workspace/glow-center.svg';
import glowCorner from '@/assets/figma/workspace/glow-corner.svg';
import gitBranch from '@/assets/figma/workspace/icon-git-branch.svg';
import gitMerge from '@/assets/figma/workspace/icon-git-merge.svg';
import lineDivider from '@/assets/figma/workspace/line-divider.svg';
import { CommandComposer } from '@/components/ui/CommandComposer';
import { IconButton } from '@/components/ui/IconButton';
import { LaunchIdeButton } from '@/components/ui/LaunchIdeButton';
import { SoftGlowOrb } from '@/components/ui/SoftGlowOrb';
import { ToolbarSelect } from '@/components/ui/ToolbarSelect';
import { ConversationTurnCard } from '@/components/workspace/ConversationTurnCard';
import { LoadingState } from '@/components/brand/LoadingState';
import { shellUiStore, useShellUi } from '@/lib/shellUi';
import { commands } from '@/lib/commands';
import type { ConversationTurn } from '@/lib/workflows/conversation';
import { cn } from '@/lib/utils';

export interface ChatHubProps {
  turns: ConversationTurn[];
  draft: string;
  onDraftChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
  onCancel?: () => void;
  onRetry?: () => void;
  modelLabel: string;
  onModelClick?: () => void;
  providers?: { id: string; name: string; status?: string }[];
  activeProviderId?: string | null;
  onSelectProvider?: (providerId: string) => void;
  worktreeLabel: string;
  branchLabel: string;
  onWorktreeClick?: () => void;
  onBranchClick?: () => void;
  onMicClick?: () => void;
  className?: string;
}

/**
 * Desktop-2 chat hub main stage — Figma 478:284 center composition.
 * Empty state matches designed welcome + composer; turns render above composer.
 */
export function ChatHub({
  turns,
  draft,
  onDraftChange,
  onSubmit,
  busy,
  error,
  onCancel,
  onRetry,
  modelLabel,
  onModelClick,
  providers,
  activeProviderId,
  onSelectProvider,
  worktreeLabel,
  branchLabel,
  onWorktreeClick,
  onBranchClick,
  onMicClick,
  className,
}: ChatHubProps) {
  const navigate = useNavigate();
  const shell = useShellUi();
  const empty = turns.length === 0 && !busy;

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  /** Whether the transcript is pinned to the bottom (auto-follow streaming). */
  const pinnedRef = useRef(true);
  const prevCountRef = useRef(turns.length);

  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  /** Between submit and the first streamed token. */
  const awaitingResponse = busy && lastTurn?.role === 'user';
  /** The PRISM turn currently receiving streamed content. */
  const streamingTurnId = busy && lastTurn?.role === 'prism' ? lastTurn.id : null;

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    const added = turns.length > prevCountRef.current;
    const lastIsUser = turns[turns.length - 1]?.role === 'user';
    prevCountRef.current = turns.length;
    // Always follow the user's own message; otherwise only when pinned.
    if ((added && lastIsUser) || pinnedRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [turns, busy]);

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden bg-prism-editor prism-enter',
        className,
      )}
      data-node-id="478:284"
      data-name="Desktop - 2"
    >
      <SoftGlowOrb
        src={glowCenter}
        className="left-[480px] top-[127px] h-[764px] w-[905px] opacity-90"
      />
      <SoftGlowOrb
        src={glowCorner}
        className="left-[617px] top-[283px] h-[516px] w-[636px] -rotate-[158deg] opacity-80"
      />

      {/* Figma 478:284 empty state — Launch IDE only (panel chrome lives in shell). */}
      <div className="absolute right-8 top-8 z-10 flex items-center gap-2 md:right-12 md:top-10">
        {!empty ? (
          <>
            <IconButton
              title="Toggle intelligence panel"
              active={shell.rightOpen}
              onClick={() => shellUiStore.toggleRight()}
            >
              <PanelRight className="h-4 w-4" />
            </IconButton>
            <IconButton
              title="Toggle execution dock"
              active={shell.bottomOpen}
              onClick={() => shellUiStore.toggleBottom()}
            >
              <PanelBottom className="h-4 w-4" />
            </IconButton>
          </>
        ) : null}
        <LaunchIdeButton
          onClick={() => {
            if (worktreeLabel && worktreeLabel !== 'Open Workspace' && worktreeLabel !== 'New Worktree') {
              navigate('/editor');
              return;
            }
            void commands.execute('workspace:open');
          }}
        />
      </div>

      <div className="relative z-[1] flex h-full flex-col">
        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-20 prism-enter-up">
            <h1 className="font-afacad text-[42.164px] font-semibold uppercase leading-none tracking-normal text-white">
              <span className="font-normal">welcome to </span>
              <span className="font-black">prism</span>
            </h1>
            <p className="mt-4 font-afacad text-[24px] font-normal uppercase leading-none text-white">
              clarity. focus. intelligence
            </p>

            <div className="mt-12 w-full max-w-[670px]">
              <CommandComposer
                value={draft}
                onChange={onDraftChange}
                onSubmit={onSubmit}
                modelLabel={modelLabel}
                onModelClick={onModelClick}
                providers={providers}
                activeProviderId={activeProviderId}
                onSelectProvider={onSelectProvider}
                busy={busy}
                onMicClick={onMicClick}
              />
              <div className="mt-3 flex items-center justify-center gap-4 px-2">
                <ToolbarSelect
                  iconSrc={gitMerge}
                  label={worktreeLabel}
                  onClick={onWorktreeClick}
                  empty={worktreeLabel === 'New Worktree'}
                />
                <img src={lineDivider} alt="" className="h-[15px] w-px rotate-90 opacity-60" draggable={false} />
                <ToolbarSelect
                  iconSrc={gitBranch}
                  label={branchLabel}
                  onClick={onBranchClick}
                  empty={branchLabel === 'Main' && !worktreeLabel}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              onScroll={onScroll}
              className="min-h-0 flex-1 overflow-y-auto px-6 pt-16 pb-4 md:px-12"
            >
              <div className="mx-auto max-w-[720px] space-y-4">
                {turns.map((turn) => (
                  <ConversationTurnCard
                    key={turn.id}
                    turn={turn}
                    streaming={turn.id === streamingTurnId}
                  />
                ))}
                {awaitingResponse && <LoadingState kind="milly" />}
                {error && (
                  <div
                    className="prism-enter-up flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/[0.07] p-3 text-[13px]"
                    role="alert"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-400" />
                    <div className="min-w-0 flex-1">
                      <p className="font-manrope font-semibold text-rose-200">
                        PRISM couldn&apos;t respond
                      </p>
                      <p className="mt-0.5 break-words font-manrope text-rose-200/75">{error}</p>
                      {onRetry ? (
                        <button
                          type="button"
                          onClick={onRetry}
                          className="mt-2 rounded-control border border-rose-400/30 px-2.5 py-1 font-manrope text-[12px] text-rose-100 hover:bg-rose-500/20"
                        >
                          Retry
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>
            <div className="shrink-0 border-t border-prism-subtle bg-prism-editor/80 px-6 py-4 backdrop-blur-md md:px-12">
              <div className="mx-auto max-w-[670px]">
                <CommandComposer
                  value={draft}
                  onChange={onDraftChange}
                  onSubmit={onSubmit}
                  modelLabel={modelLabel}
                  onModelClick={onModelClick}
                  providers={providers}
                  activeProviderId={activeProviderId}
                  onSelectProvider={onSelectProvider}
                  busy={busy}
                  onCancel={onCancel}
                  onMicClick={onMicClick}
                />
                <div className="mt-2 flex items-center justify-center gap-4">
                  <ToolbarSelect iconSrc={gitMerge} label={worktreeLabel} onClick={onWorktreeClick} />
                  <img src={lineDivider} alt="" className="h-[15px] w-px rotate-90 opacity-60" draggable={false} />
                  <ToolbarSelect iconSrc={gitBranch} label={branchLabel} onClick={onBranchClick} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
