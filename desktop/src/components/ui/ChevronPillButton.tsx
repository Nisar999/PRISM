import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import chevronUrl from '@/assets/figma/landing/icon-chevron.svg';

export interface ChevronPillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

/** Pill chevron submit — hover / focus / press / loading / disabled. */
export const ChevronPillButton = forwardRef<HTMLButtonElement, ChevronPillButtonProps>(
  function ChevronPillButton({ className, loading, disabled, ...props }, ref) {
    const inert = disabled || loading;
    return (
      <button
        ref={ref}
        type="button"
        disabled={inert}
        aria-busy={loading || undefined}
        className={cn(
          'relative flex h-[56px] w-[145px] items-center justify-center overflow-hidden rounded-[25px]',
          'bg-[rgba(0,0,0,0.3)] transition-[transform,background-color,opacity] duration-200',
          'hover:scale-[1.04] hover:bg-[rgba(0,20,60,0.45)] active:scale-[0.97]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'focus-visible:outline-[color-mix(in_srgb,var(--prism-focus)_70%,transparent)]',
          'disabled:pointer-events-none disabled:opacity-40 disabled:hover:scale-100',
          loading &&
            'bg-[linear-gradient(110deg,rgba(0,0,0,0.3)_30%,rgba(0,191,255,0.25)_50%,rgba(0,0,0,0.3)_70%)] bg-[length:200%_100%] animate-[auth-shimmer_1.2s_linear_infinite]',
          className,
        )}
        {...props}
      >
        <img
          src={chevronUrl}
          alt=""
          className={cn('size-[39px] object-contain opacity-95', loading && 'opacity-50')}
          draggable={false}
        />
      </button>
    );
  },
);
