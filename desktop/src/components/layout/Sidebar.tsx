import { WorkspaceExplorer } from '../WorkspaceExplorer';

/**
 * Figma 434:2 Sidebar — explorer surface (220px default).
 * Activity bar owns primary navigation; this panel is workspace content only.
 */
export function Sidebar() {
  return (
    <aside className="flex h-full w-full flex-col overflow-hidden" aria-label="Explorer">
      <div className="flex h-9 shrink-0 items-center border-b border-white/[0.06] px-3">
        <span className="font-manrope text-[11px] font-semibold uppercase tracking-[0.08em] text-prism-meta">
          Explorer
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <WorkspaceExplorer />
      </div>
    </aside>
  );
}
