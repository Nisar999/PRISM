import { LOADING_COPY, LoadingKind, brandAssets } from '@/lib/brand';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  kind?: LoadingKind;
  message?: string;
  className?: string;
  /** Show PRISM element as subtle accent. */
  showElement?: boolean;
}

export function LoadingState({
  kind = 'default',
  message,
  className,
  showElement = true,
}: LoadingStateProps) {
  const copy = message ?? LOADING_COPY[kind];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-10 px-4 text-center',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {showElement && (
        <img
          src={brandAssets.element}
          alt=""
          className="h-14 w-auto object-contain opacity-70 animate-pulse"
          draggable={false}
        />
      )}
      <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 rounded-full bg-primary/80 animate-[shimmer_1.2s_ease-in-out_infinite]" />
      </div>
      <p className="text-sm text-muted-foreground">{copy}</p>
    </div>
  );
}
