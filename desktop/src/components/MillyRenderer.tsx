import { useState } from 'react';
import { useMilly, MillyPresenceState } from '@/lib/milly';
import { brandAssets } from '@/lib/brand';
import { cn } from '@/lib/utils';

export function MillyRenderer() {
  const milly = useMilly();
  const [hovered, setHovered] = useState(false);

  const getStateColors = (state: MillyPresenceState) => {
    switch (state) {
      case 'success':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
      case 'failure':
        return 'text-rose-500 bg-rose-500/10 border-rose-500/30';
      case 'validation':
        return 'text-violet-500 bg-violet-500/10 border-violet-500/30';
      case 'executing':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      case 'planning':
        return 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30';
      case 'thinking':
      case 'reflecting':
        return 'text-purple-500 bg-purple-500/10 border-purple-500/30';
      case 'retrieving':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      case 'routing':
        return 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30';
      case 'paused':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      case 'waiting':
        return 'text-muted-foreground bg-muted border-border';
      case 'idle':
      default:
        return 'text-primary bg-primary/5 border-primary/20';
    }
  };

  /** Compact presence — mascot only for thinking/success moments (not a permanent pin). */
  const showMascot =
    milly.activeState === 'thinking' ||
    milly.activeState === 'reflecting' ||
    milly.activeState === 'success';

  const renderMillyGraphic = (state: MillyPresenceState) => {
    if (showMascot) {
      return (
        <img
          src={brandAssets.milly}
          alt=""
          className={cn(
            'w-7 h-7 object-contain',
            (state === 'thinking' || state === 'reflecting') && 'animate-pulse',
          )}
          draggable={false}
        />
      );
    }

    switch (state) {
      case 'planning':
        return (
          <svg className="w-5 h-5 animate-[spin_6s_linear_infinite]" viewBox="0 0 100 100">
            <rect x="25" y="25" width="50" height="50" fill="none" stroke="currentColor" strokeWidth="6" className="opacity-80" />
            <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="5" className="opacity-50" />
            <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="5" className="opacity-50" />
          </svg>
        );
      case 'retrieving':
        return (
          <svg className="w-5 h-5" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="10" fill="currentColor" />
            <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="4" className="animate-[ping_2s_ease-in-out_infinite]" />
          </svg>
        );
      case 'executing':
        return (
          <svg className="w-5 h-5" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="18" fill="currentColor" />
            <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray="60 30" className="animate-[spin_1.5s_linear_infinite]" />
          </svg>
        );
      case 'failure':
        return (
          <svg className="w-5 h-5" viewBox="0 0 100 100">
            <polygon points="50,15 85,50 50,85 15,50" fill="currentColor" />
            <line x1="35" y1="35" x2="65" y2="65" stroke="#fff" strokeWidth="8" />
            <line x1="65" y1="35" x2="35" y2="65" stroke="#fff" strokeWidth="8" />
          </svg>
        );
      case 'idle':
      default:
        return (
          <div className="relative w-4 h-4">
            <div className="absolute inset-0 rounded-full bg-primary/40 animate-ping opacity-25" />
            <div className="absolute inset-0.5 rounded-full bg-primary opacity-80 animate-[pulse_4s_ease-in-out_infinite]" />
          </div>
        );
    }
  };

  return (
    <div
      className="relative flex items-center select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-300',
          getStateColors(milly.activeState),
        )}
      >
        {renderMillyGraphic(milly.activeState)}
      </div>

      {hovered && (
        <div className="absolute top-11 right-0 z-50 w-64 p-3 bg-card border border-border rounded-lg shadow-xl prism-enter-up text-left font-mono">
          <div className="flex items-center justify-between pb-1.5 border-b border-border text-[10px]">
            <span className="text-muted-foreground uppercase font-bold">Milly</span>
            <span className="px-1.5 py-0.5 rounded font-semibold uppercase text-[9px] border border-border">
              {milly.activeState}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-foreground mt-2 font-normal font-sans">
            {milly.message}
          </p>
        </div>
      )}
    </div>
  );
}

export default MillyRenderer;
