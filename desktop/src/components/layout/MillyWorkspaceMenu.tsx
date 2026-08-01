import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { workspaceStore } from '@/lib/store';
import { appNavigate } from '@/lib/appNavigation';
import { MILLY_VIEWS, type MillyViewId } from '@/lib/millyViews';

const MENU_ITEMS: { id: MillyViewId; label: string }[] = [
  { id: 'prism', label: 'PRISM View' },
  { id: 'globe', label: 'Globe View' },
];

/**
 * TitleBar Milly Workspace Menu.
 * Opens PRISM / Globe as center editor tabs — no Mirror, no popups/modals.
 */
export function MillyWorkspaceMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openView = (id: MillyViewId) => {
    const view = MILLY_VIEWS[id];
    workspaceStore.openPane(view.id);
    appNavigate(view.path);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative pointer-events-auto ml-4" data-name="MillyWorkspaceMenu">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1 font-manrope text-[17px] font-semibold leading-none',
          'text-prism-muted transition-colors hover:text-white',
          open && 'text-white',
        )}
        onClick={() => setOpen((v) => !v)}
      >
        Milly
        <ChevronDown className={cn('h-4 w-4 opacity-70 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Milly Workspace"
          className="absolute left-0 top-full z-50 mt-2 min-w-[180px] rounded-control border border-white/[0.08] bg-prism-panel py-1 shadow-prism-elevated"
        >
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left font-manrope text-sm text-prism-muted hover:bg-prism-fill hover:text-white"
              onClick={() => openView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
