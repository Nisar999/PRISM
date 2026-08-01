import { X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useWorkspace, workspaceStore } from '@/lib/store';
import { appNavigate } from '@/lib/appNavigation';
import {
  MILLY_VIEWS,
  isMillyViewId,
  millyViewFromPath,
  type MillyViewId,
} from '@/lib/millyViews';
import { cn } from '@/lib/utils';

/**
 * Center editor tab strip for Milly views — reuses PanelTabs visual language.
 * Driven by workspaceStore.openPanes (no new tab manager).
 */
export function EditorTabBar() {
  const workspace = useWorkspace();
  const location = useLocation();

  const millyTabs = workspace.openPanes.filter(isMillyViewId) as MillyViewId[];
  if (millyTabs.length === 0) return null;

  const pathActive = millyViewFromPath(location.pathname);
  const active =
    (pathActive && millyTabs.includes(pathActive) ? pathActive : null) ??
    (workspace.activePane && isMillyViewId(workspace.activePane)
      ? workspace.activePane
      : millyTabs[millyTabs.length - 1]);

  const activate = (id: MillyViewId) => {
    workspaceStore.setActivePane(id);
    appNavigate(MILLY_VIEWS[id].path);
  };

  const close = (id: MillyViewId, e: React.MouseEvent) => {
    e.stopPropagation();
    workspaceStore.closePane(id);
    const remaining = workspaceStore
      .getSnapshot()
      .openPanes.filter(isMillyViewId) as MillyViewId[];
    if (remaining.length === 0) {
      appNavigate('/');
      return;
    }
    const next = remaining[remaining.length - 1];
    workspaceStore.setActivePane(next);
    appNavigate(MILLY_VIEWS[next].path);
  };

  return (
    <div
      className="prism-shell-surface flex h-9 shrink-0 items-center gap-1 border-b px-2"
      data-name="EditorTabBar"
      role="tablist"
      aria-label="Milly workspace tabs"
    >
      {millyTabs.map((id) => {
        const view = MILLY_VIEWS[id];
        const isActive = active === id;
        return (
          <div
            key={id}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'group inline-flex max-w-[200px] items-center gap-0.5 rounded-control text-prism-xs font-medium transition-all duration-press',
              isActive
                ? 'bg-prism-fill text-white prism-inset-focus'
                : 'text-prism-meta hover:bg-prism-soft hover:text-white',
            )}
          >
            <button
              type="button"
              className="truncate px-2.5 py-1 prism-focus-ring-sm"
              onClick={() => activate(id)}
            >
              {view.label}
            </button>
            <button
              type="button"
              className="mr-1 rounded p-0.5 opacity-50 hover:bg-white/10 hover:opacity-100"
              onClick={(e) => close(id, e)}
              title={`Close ${view.label}`}
              aria-label={`Close ${view.label}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
