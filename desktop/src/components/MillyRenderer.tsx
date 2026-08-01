import { useEffect, useRef } from 'react';
import {
  useMilly,
  millyEngine,
  MILLY_STATE_SPECS,
  type MillyPresenceState,
} from '@/lib/milly';
import { useSettings } from '@/lib/settings';
import { brandAssets } from '@/lib/brand';
import { cn } from '@/lib/utils';

/**
 * Sole Milly presence renderer — TitleBar ambient indicator.
 * Maps millyStore states to motion/color. Success burst completion is
 * reported back to millyEngine (event-driven settle — no fake timers).
 */
export function MillyRenderer() {
  const milly = useMilly();
  const settings = useSettings();
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced =
    !settings.milly.animationsEnabled ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (milly.activeState !== 'success') return;
    const el = rootRef.current;
    if (!el) return;
    const onEnd = (ev: AnimationEvent) => {
      if (ev.animationName.includes('milly-burst')) {
        millyEngine.acknowledgeSuccessAnimation();
      }
    };
    el.addEventListener('animationend', onEnd);
    // Reduced-motion: acknowledge immediately via rAF (still event-driven frame).
    let raf = 0;
    if (reduced) {
      raf = requestAnimationFrame(() => millyEngine.acknowledgeSuccessAnimation());
    }
    return () => {
      el.removeEventListener('animationend', onEnd);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [milly.activeState, milly.generation, reduced]);

  const spec = MILLY_STATE_SPECS[milly.activeState];
  const showMascot =
    settings.milly.thinkingAnimation &&
    (milly.activeState === 'thinking' ||
      milly.activeState === 'writing' ||
      milly.activeState === 'success' ||
      milly.activeState === 'speaking');

  return (
    <div
      ref={rootRef}
      className="relative flex items-center select-none"
      title={milly.message ?? spec.statusText}
      role="status"
      aria-live="polite"
      aria-label={`Milly: ${spec.statusText}`}
      data-milly-state={milly.activeState}
      data-milly-generation={milly.generation}
    >
      <div
        className={cn(
          'flex size-9 items-center justify-center rounded-xl border transition-[color,background-color,border-color,opacity,transform] duration-300',
          toneClass(spec.tone),
          !reduced && motionClass(spec.motion, milly.activeState),
          milly.attentionLevel === 'zero' && 'opacity-55',
          milly.attentionLevel === 'high' && 'ring-1 ring-current/40',
        )}
      >
        {showMascot ? (
          <img
            src={brandAssets.milly}
            alt=""
            className={cn(
              'size-7 object-contain transition-opacity duration-300',
              milly.activeState === 'speaking' && 'opacity-100',
            )}
            draggable={false}
          />
        ) : (
          <MillyGlyph state={milly.activeState} reduced={reduced} />
        )}
      </div>

      {/* Compact status chip — cognitive label, not chatbot speech */}
      {milly.attentionLevel !== 'zero' || settings.milly.debug ? (
        <span className="ml-2 hidden max-w-[140px] truncate font-manrope text-[11px] font-medium text-prism-muted lg:inline">
          {settings.milly.debug
            ? `${milly.activeState}${milly.activeNode ? `:${milly.activeNode}` : ''}`
            : (milly.message ?? spec.statusText)}
        </span>
      ) : null}
    </div>
  );
}

function toneClass(
  tone: (typeof MILLY_STATE_SPECS)[MillyPresenceState]['tone'],
): string {
  switch (tone) {
    case 'ok':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    case 'err':
      return 'border-rose-500/40 bg-rose-500/10 text-rose-400';
    case 'warn':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-400';
    case 'plan':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400';
    case 'search':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'code':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-400';
    case 'run':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
    case 'review':
      return 'border-violet-500/30 bg-violet-500/10 text-violet-400';
    case 'speak':
      return 'border-prism-focus/40 bg-prism-focus/10 text-prism-focus';
    case 'focus':
      return 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300';
    case 'off':
      return 'border-white/10 bg-white/5 text-prism-dim';
    case 'idle':
    default:
      return 'border-primary/20 bg-primary/5 text-primary';
  }
}

function motionClass(motion: string, state: MillyPresenceState): string {
  switch (motion) {
    case 'breathe':
      return 'milly-motion-breathe';
    case 'wave':
    case 'morph':
      return 'milly-motion-morph';
    case 'grid':
      return 'milly-motion-grid';
    case 'radar':
    case 'scan':
      return 'milly-motion-radar';
    case 'spin':
    case 'pulse-solid':
      return 'milly-motion-spin';
    case 'oscillate':
      return 'milly-motion-oscillate';
    case 'type':
      return 'milly-motion-type';
    case 'speak':
      return 'milly-motion-speak';
    case 'burst':
      return state === 'success' ? 'milly-motion-burst' : '';
    case 'pulse-warn':
      return 'milly-motion-warn';
    case 'glitch':
      return 'milly-motion-glitch';
    case 'dim':
    case 'static':
    default:
      return '';
  }
}

function MillyGlyph({
  state,
  reduced,
}: {
  state: MillyPresenceState;
  reduced: boolean;
}) {
  switch (state) {
    case 'planning':
      return (
        <svg className="size-5" viewBox="0 0 100 100" aria-hidden>
          <rect x="25" y="25" width="50" height="50" fill="none" stroke="currentColor" strokeWidth="6" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="5" opacity="0.5" />
          <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="5" opacity="0.5" />
        </svg>
      );
    case 'searching':
    case 'reading':
      return (
        <svg className="size-5" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="10" fill="currentColor" />
          <circle
            cx="50"
            cy="50"
            r="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className={reduced ? '' : 'animate-[ping_2s_ease-in-out_infinite]'}
          />
        </svg>
      );
    case 'executing':
    case 'coding':
      return (
        <svg className="size-5" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="16" fill="currentColor" />
          <circle
            cx="50"
            cy="50"
            r="32"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeDasharray="60 30"
          />
        </svg>
      );
    case 'error':
      return (
        <svg className="size-5" viewBox="0 0 100 100" aria-hidden>
          <polygon points="50,15 85,50 50,85 15,50" fill="currentColor" />
          <line x1="35" y1="35" x2="65" y2="65" stroke="#fff" strokeWidth="8" />
          <line x1="65" y1="35" x2="35" y2="65" stroke="#fff" strokeWidth="8" />
        </svg>
      );
    case 'warning':
      return (
        <svg className="size-5" viewBox="0 0 100 100" aria-hidden>
          <polygon points="50,12 90,82 10,82" fill="none" stroke="currentColor" strokeWidth="8" />
          <rect x="46" y="36" width="8" height="24" fill="currentColor" />
          <circle cx="50" cy="72" r="4" fill="currentColor" />
        </svg>
      );
    case 'offline':
      return (
        <svg className="size-5 opacity-60" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" strokeWidth="6" />
          <line x1="28" y1="28" x2="72" y2="72" stroke="currentColor" strokeWidth="6" />
        </svg>
      );
    case 'listening':
      return (
        <svg className="size-5" viewBox="0 0 100 100" aria-hidden>
          <rect x="42" y="20" width="16" height="36" rx="8" fill="currentColor" />
          <path d="M30 48a20 20 0 0040 0" fill="none" stroke="currentColor" strokeWidth="6" />
          <line x1="50" y1="68" x2="50" y2="82" stroke="currentColor" strokeWidth="6" />
        </svg>
      );
    case 'reviewing':
      return (
        <svg className="size-5" viewBox="0 0 100 100" aria-hidden>
          <rect x="18" y="28" width="28" height="44" fill="none" stroke="currentColor" strokeWidth="5" />
          <rect x="54" y="28" width="28" height="44" fill="none" stroke="currentColor" strokeWidth="5" opacity="0.6" />
        </svg>
      );
    case 'idle':
    case 'waiting':
    default:
      return (
        <div className="relative size-4">
          <div className="absolute inset-0 rounded-full bg-current opacity-30" />
          <div className="absolute inset-0.5 rounded-full bg-current opacity-80" />
        </div>
      );
  }
}

export default MillyRenderer;
