import { brandAssets, PRODUCT } from '@/lib/brand';
import type { ConversationTurn } from '@/lib/workflows/conversation';
import { PrismMarkdown } from '@/components/workspace/PrismMarkdown';
import { cn } from '@/lib/utils';

export interface ConversationTurnCardProps {
  turn: ConversationTurn;
  /** True while this turn is still receiving streamed content. */
  streaming?: boolean;
  className?: string;
}

/** Reusable conversation bubble for hub transcript. */
export function ConversationTurnCard({ turn, streaming = false, className }: ConversationTurnCardProps) {
  return (
    <article
      className={cn(
        'space-y-2 rounded-2xl border border-prism-border p-4 text-sm backdrop-blur-sm',
        'prism-enter-up',
        turn.role === 'user'
          ? 'ml-4 border-prism-border bg-prism-soft sm:ml-12'
          : 'mr-4 border-prism-border bg-[#1c1c1c]/90 sm:mr-8',
        className,
      )}
    >
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-prism-meta">
        {turn.role === 'prism' && (
          <img src={brandAssets.logo} alt="" className="h-4 w-auto object-contain" draggable={false} />
        )}
        <span>{turn.role === 'user' ? 'You' : PRODUCT.name}</span>
        {turn.intent && <span>· {turn.intent}</span>}
        {typeof turn.memoryHits === 'number' && <span>· memory {turn.memoryHits}</span>}
        {typeof turn.trustScore === 'number' && (
          <span>· trust {turn.trustScore.toFixed(2)}</span>
        )}
        {streaming ? <span className="text-prism-focus">· streaming</span> : null}
      </div>

      {turn.role === 'prism' ? (
        <div className="relative">
          <PrismMarkdown content={turn.content || (streaming ? '…' : '')} />
          {streaming ? (
            <span
              className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] animate-pulse rounded-full bg-prism-focus"
              aria-hidden="true"
            />
          ) : null}
        </div>
      ) : (
        <p className="whitespace-pre-wrap leading-relaxed text-white/90">{turn.content}</p>
      )}

      {turn.role === 'prism' && turn.plan ? (
        <details className="text-xs text-prism-meta">
          <summary className="cursor-pointer font-medium text-white/80">Plan</summary>
          <div className="mt-2">
            <PrismMarkdown content={turn.plan} className="text-xs" />
          </div>
        </details>
      ) : null}
      {turn.role === 'prism' && turn.reasoning ? (
        <details className="text-xs text-prism-meta" open={streaming && !turn.content}>
          <summary className="cursor-pointer font-medium text-white/80">Reasoning</summary>
          <div className="mt-2">
            <PrismMarkdown content={turn.reasoning} className="text-xs" />
          </div>
        </details>
      ) : null}
      {turn.role === 'prism' && turn.reflection ? (
        <details className="text-xs text-prism-meta">
          <summary className="cursor-pointer font-medium text-white/80">Reflection</summary>
          <div className="mt-2">
            <PrismMarkdown content={turn.reflection} className="text-xs" />
          </div>
        </details>
      ) : null}
    </article>
  );
}
