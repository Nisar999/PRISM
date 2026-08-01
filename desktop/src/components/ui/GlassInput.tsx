import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  iconSrc?: string;
  iconAlt?: string;
}

/** Frosted field — focus / disabled / loading-ready presentation. */
export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  function GlassInput({ className, iconSrc, iconAlt = '', disabled, ...props }, ref) {
    return (
      <label
        className={cn(
          'relative flex h-[64px] w-full items-center rounded-[18px]',
          'bg-[var(--prism-input)]',
          'transition-[box-shadow,background-color,opacity] duration-200',
          'focus-within:bg-[var(--prism-input-focus)]',
          'focus-within:shadow-[0_0_0_1px_color-mix(in_srgb,var(--prism-focus)_55%,transparent)]',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        {iconSrc ? (
          <img
            src={iconSrc}
            alt={iconAlt}
            className="pointer-events-none absolute left-[14px] size-6 object-contain opacity-90"
            draggable={false}
          />
        ) : null}
        <input
          ref={ref}
          disabled={disabled}
          className={cn(
            'h-full w-full bg-transparent px-4 font-["Afacad_Flux"] text-[16px] font-bold text-white',
            'placeholder:text-white/90 outline-none',
            'disabled:cursor-not-allowed',
            iconSrc ? 'pl-[56px]' : 'pl-4',
          )}
          {...props}
        />
      </label>
    );
  },
);
