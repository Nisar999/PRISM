import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

/** Glass panel — shared auth / elevated glass surface. */
export const GlassCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function GlassCard({ className, children, ...props }, ref) {
    return (
      <div ref={ref} className={cn('prism-glass-panel relative overflow-hidden', className)} {...props}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-prism-inset-glass"
        />
        <div className="relative z-[1] h-full w-full">{children}</div>
      </div>
    );
  },
);
