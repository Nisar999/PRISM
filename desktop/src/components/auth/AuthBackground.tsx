import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface AuthBackgroundProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

/**
 * Auth stage background — editor token from Figma UI shell (434:2 --bg/editor).
 */
export function AuthBackground({ children, className, ...props }: AuthBackgroundProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[var(--prism-bg-editor)] prism-enter',
        className,
      )}
      data-name="AuthBackground"
      {...props}
    >
      {children}
    </div>
  );
}
