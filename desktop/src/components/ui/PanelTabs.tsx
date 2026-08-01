import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PanelTab<T extends string = string> {
  id: T;
  label: string;
}

export interface PanelTabsProps<T extends string = string> {
  tabs: PanelTab<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  trailing?: ReactNode;
}

/** Shared dock / inspector tab strip. */
export function PanelTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
  trailing,
}: PanelTabsProps<T>) {
  return (
    <div
      className={cn(
        'prism-shell-surface flex h-9 shrink-0 items-center gap-1 border-b px-2',
        className,
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-control px-2.5 py-1 text-prism-xs font-medium transition-all duration-press',
            'hover:text-white prism-focus-ring-sm active:scale-[0.97]',
            active === tab.id
              ? 'bg-prism-fill text-white prism-inset-focus'
              : 'text-prism-meta hover:bg-prism-soft',
          )}
        >
          {tab.label}
        </button>
      ))}
      {trailing}
    </div>
  );
}
