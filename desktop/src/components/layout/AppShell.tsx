import { Outlet, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useRef } from 'react';
import { TitleBar } from './TitleBar';
import { ActivityBar } from './ActivityBar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { IntelligenceRail } from './IntelligenceRail';
import { ExecutionDock } from './ExecutionDock';
import { EditorTabBar } from './EditorTabBar';
import { CommandPalette } from '../CommandPalette';
import { NotificationToasts } from '../NotificationToasts';
import { PanelResizeHandle } from '../ui/PanelResizeHandle';
import { shellUiStore, useShellUi } from '@/lib/shellUi';
import { useExperienceOrchestration } from '@/lib/useExperienceOrchestration';
import { commands } from '@/lib/commands';
import { isNativeDesktop } from '@/lib/nativeFolder';
import { persistShellLayout } from '@/lib/sessionRestore';

/**
 * Approved IDE shell (Figma 434:2).
 *
 * On `/editor`, Code-OSS owns Explorer / Editor / Tabs / Terminal / Problems / Search.
 * Milly views (PRISM / Globe) open as PRISM center editor tabs via EditorTabBar.
 */
export function AppShell() {
  const location = useLocation();
  const shell = useShellUi();
  useExperienceOrchestration();
  const persistTimer = useRef<number | null>(null);

  const isEditor = location.pathname.startsWith('/editor');
  const isSettings = location.pathname.startsWith('/settings');
  /** Cursor-style settings / Code-OSS editor: collapse PRISM IDE chrome. */
  const chromeCollapsed = isEditor || isSettings;

  const schedulePersist = useCallback(() => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      void persistShellLayout();
    }, 600);
  }, []);

  const onSidebarDrag = useCallback(
    (delta: number) => {
      shellUiStore.setSidebarWidth(shellUiStore.getSnapshot().sidebarWidth + delta);
      schedulePersist();
    },
    [schedulePersist],
  );

  const onAgentDrag = useCallback(
    (delta: number) => {
      shellUiStore.setAgentWidth(shellUiStore.getSnapshot().agentWidth - delta);
      schedulePersist();
    },
    [schedulePersist],
  );

  const onBottomDrag = useCallback(
    (delta: number) => {
      shellUiStore.setBottomHeight(shellUiStore.getSnapshot().bottomHeight - delta);
      schedulePersist();
    },
    [schedulePersist],
  );

  /** Tauri drag-and-drop folders → existing open-workspace workflow. */
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      if (!(await isNativeDesktop())) return;
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        unlisten = await getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type !== 'drop') return;
          const paths = event.payload.paths;
          if (!paths?.length) return;
          const folder = paths[0];
          void commands.execute('workspace:open-path', [folder]);
        });
      } catch (err) {
        console.warn('Drag-drop folder open unavailable:', err);
      }
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  const showPrismIdeChrome = !chromeCollapsed;
  const showLeft = showPrismIdeChrome && shell.leftOpen;
  const showBottom = showPrismIdeChrome && shell.bottomOpen;

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-prism-editor text-foreground"
      data-name="UI"
      data-editor-mode={isEditor ? 'code-oss' : isSettings ? 'settings' : 'prism'}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        /* Browser fallback: cannot read local folder paths from FileList securely. */
        e.preventDefault();
      }}
    >
      <TitleBar />

      <div className="flex min-h-0 flex-1 overflow-hidden border-white/[0.06]" data-name="BodyRow">
        {showPrismIdeChrome ? <ActivityBar /> : null}

        {showLeft ? (
          <>
            <div
              className="flex h-full shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-prism-panel"
              style={{ width: shell.sidebarWidth }}
              data-name="Sidebar"
            >
              <Sidebar />
            </div>
            <PanelResizeHandle axis="x" onDrag={onSidebarDrag} label="Resize sidebar" />
          </>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" data-name="CenterColumn">
          {!isEditor && !isSettings ? <EditorTabBar /> : null}
          <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-prism-editor">
            <div
              className={
                isEditor || isSettings
                  ? 'h-full min-h-0 overflow-hidden'
                  : 'h-full min-h-0 overflow-auto'
              }
            >
              <Outlet />
            </div>
          </main>

          {showBottom ? (
            <>
              <PanelResizeHandle axis="y" onDrag={onBottomDrag} label="Resize execution dock" />
              <div
                className="shrink-0 overflow-hidden border-t border-white/[0.06]"
                style={{ height: shell.bottomHeight }}
                data-name="ExecutionDock"
              >
                <ExecutionDock />
              </div>
            </>
          ) : null}
        </div>

        {shell.rightOpen && !chromeCollapsed ? (
          <>
            <PanelResizeHandle axis="x" onDrag={onAgentDrag} label="Resize agent panel" />
            <div
              className="flex h-full shrink-0 flex-col overflow-hidden border-l border-white/[0.06] bg-prism-panel"
              style={{ width: shell.agentWidth }}
              data-name="AIPanel"
            >
              <IntelligenceRail />
            </div>
          </>
        ) : null}
      </div>

      <StatusBar />
      <CommandPalette />
      <NotificationToasts />
    </div>
  );
}
