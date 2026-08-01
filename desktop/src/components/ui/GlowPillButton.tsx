import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Neon inset glow pill — Figma Opening Page CTA (node 479:118 / 479:87).
 * Presentation only; no business logic.
 */
export interface GlowPillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export const GlowPillButton = forwardRef<HTMLButtonElement, GlowPillButtonProps>(
  function GlowPillButton({ label, className, style, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'relative isolate overflow-hidden rounded-[31.449px] border-0 bg-transparent p-0',
          'cursor-pointer select-none transition-transform duration-300',
          'hover:scale-[1.015] active:scale-[0.99]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40',
          className,
        )}
        style={style}
        {...props}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-[31.449px] bg-[#121212]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] animate-[opening-glow-pulse_2.8s_ease-in-out_infinite]"
          style={{
            boxShadow:
              'inset -2.419px 4.838px 9.193px 0px rgba(30,0,255,0.85), inset 0px 8.467px 10.04px 0px rgba(21,255,0,0.76), inset 0px 10.886px 16.571px 0px rgba(255,0,0,0.83)',
          }}
        />
        <span
          className={cn(
            'relative z-[1] flex h-full w-full items-center justify-center',
            "font-afacad font-bold leading-none text-white",
          )}
        >
          {label}
        </span>
      </button>
    );
  },
);
