import { cn } from '@/lib/utils';

export interface ProviderIndicatorProps {
  name: string | null;
  online?: boolean;
  className?: string;
  interactive?: boolean;
  open?: boolean;
  onToggle?: () => void;
}

/** Compact provider chip — values from providerStore. */
export function ProviderIndicator({
  name,
  online = true,
  className,
  interactive = false,
  open = false,
  onToggle,
}: ProviderIndicatorProps) {
  if (!name) {
    const empty = (
      <p
        className={cn(
          "font-['Manrope'] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#686868]",
          className,
        )}
      >
        No provider configured
      </p>
    );
    if (!interactive) return empty;
    return (
      <button type="button" onClick={onToggle} className="text-left" aria-expanded={open}>
        {empty}
      </button>
    );
  }

  const body = (
    <p
      className={cn(
        "font-['Manrope'] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#adadad]",
        interactive && 'hover:text-white',
        className,
      )}
    >
      <span
        className={cn(
          'mr-2 inline-block size-1.5 rounded-full align-middle',
          online ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-[#686868]',
        )}
      />
      Provider · {name}
      {interactive ? <span className="ml-2 text-[10px] text-prism-dim">{open ? '▲' : '▼'}</span> : null}
    </p>
  );

  if (!interactive) return body;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-left"
      aria-haspopup="listbox"
      aria-expanded={open}
    >
      {body}
    </button>
  );
}
