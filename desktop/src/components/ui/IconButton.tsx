import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/** Shared shell icon control — toolbar / hub / dock close. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ className, active, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'prism-icon-btn prism-focus-ring',
          active && 'prism-icon-btn-active',
          className,
        )}
        {...props}
      />
    );
  },
);
