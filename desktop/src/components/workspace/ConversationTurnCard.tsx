import { brandAssets, PRODUCT } from '@/lib/brand';
import type { ConversationTurn } from '@/lib/workflows/conversation';
import { cn } from '@/lib/utils';

export interface ConversationTurnCardProps {
  turn: ConversationTurn;
  className?: string;
}

/** Reusable conversation bubble for hub transcript. */
export function ConversationTurnCard({ turn, className }: ConversationTurnCardProps) {
  return (
    <article
      className={cn(
        'rounded-2xl border border-prism-border p-4 text-sm space-y-2 backdrop-blur-sm',
        'prism-enter-up',
        turn.role === 'user'
          ? 'ml-4 border-prism-border bg-prism-soft sm:ml-12'
          : 'mr-4 border-prism-border bg-[#1c1c1c]/90 sm:mr-8',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-prism-meta">
        {turn.role === 'prism' && (
          <img src={brandAssets.logo} alt="" className="h-4 w-auto object-contain" draggable={false} />
        )}
        <span>{turn.role === 'user' ? 'You' : PRODUCT.name}</span>
        {turn.intent && <span>· {turn.intent}</span>}
        {typeof turn.memoryHits === 'number' && <span>· memory {turn.memoryHits}</span>}
        {typeof turn.trustScore === 'number' && (
          <span>· trust {turn.trustScore.toFixed(2)}</span>
        )}
      </div>
      <p className="whitespace-pre-wrap leading-relaxed text-white/90">{turn.content}</p>
      {turn.role === 'prism' && turn.plan && (
        <details className="text-xs text-prism-meta">
          <summary className="cursor-pointer font-medium text-white/80">Plan</summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans">{turn.plan}</pre>
        </details>
      )}
      {turn.role === 'prism' && turn.reasoning && (
        <details className="text-xs text-prism-meta">
          <summary className="cursor-pointer font-medium text-white/80">Reasoning</summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans">{turn.reasoning}</pre>
        </details>
      )}
    </article>
  );
}
