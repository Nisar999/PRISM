import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SocialAuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  logoSrc: string;
  label: string;
  loading?: boolean;
}

/** White social CTA — hover / focus / press / disabled / loading. */
export const SocialAuthButton = forwardRef<HTMLButtonElement, SocialAuthButtonProps>(
  function SocialAuthButton({ logoSrc, label, className, loading, disabled, ...props }, ref) {
    const inert = disabled || loading;
    return (
      <button
        ref={ref}
        type="button"
        disabled={inert}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex h-[53px] items-center gap-2 rounded-[10px] bg-white px-3',
          'shadow-[0px_4px_10.5px_0px_rgba(0,0,0,0.61)]',
          'transition-[transform,opacity,box-shadow] duration-200',
          'hover:scale-[1.02] active:scale-[0.98]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'focus-visible:outline-[color-mix(in_srgb,var(--prism-focus)_60%,transparent)]',
          'disabled:pointer-events-none disabled:opacity-40 disabled:hover:scale-100',
          loading && 'opacity-70',
          className,
        )}
        {...props}
      >
        <img
          src={logoSrc}
          alt=""
          className="h-[28px] w-auto max-w-[45px] object-contain"
          draggable={false}
        />
        <span className="font-['Afacad_Flux'] text-[16px] font-bold leading-none text-black">
          {loading ? '…' : label}
        </span>
      </button>
    );
  },
);
