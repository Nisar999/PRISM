import { useEffect, useRef, useState } from 'react';
import { brandAssets, PRODUCT } from '@/lib/brand';
import { commands } from '@/lib/commands';
import { shellUiStore } from '@/lib/shellUi';
import { appNavigate } from '@/lib/appNavigation';
import { useSettings } from '@/lib/settings';
import { useWorkspace } from '@/lib/store';
import { MillyWorkspaceMenu } from './MillyWorkspaceMenu';
import { WindowControls } from './WindowControls';
import { MillyRenderer } from '@/components/MillyRenderer';
import { cn } from '@/lib/utils';

type MenuId =
  | 'File'
  | 'Edit'
  | 'Selection'
  | 'View'
  | 'Go'
  | 'Run'
  | 'Terminal'
  | 'Help';

const MENU_ORDER: MenuId[] = [
  'File',
  'Edit',
  'Selection',
  'View',
  'Go',
  'Run',
  'Terminal',
  'Help',
];

interface MenuEntry {
  label: string;
  shortcut?: string;
  run: () => void | Promise<void>;
  separatorBefore?: boolean;
}

/**
 * Figma 434:2 TitleBar — each menu opens; commands execute via existing command surface.
 */
export function TitleBar() {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const settings = useSettings();
  const workspace = useWorkspace();
  const recent = settings.workspace.recentFolders;

  const windowTitle = workspace.activeProject
    ? `${workspace.activeProject.name} — ${PRODUCT.nameLong}`
    : PRODUCT.nameLong;

  useEffect(() => {
    if (!openMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  const run = async (fn: () => void | Promise<void>) => {
    setOpenMenu(null);
    await fn();
  };

  const menus: Record<MenuId, MenuEntry[]> = {
    File: [
      {
        label: 'Open Folder…',
        shortcut: 'Ctrl+O',
        run: () => commands.execute('workspace:open'),
      },
      ...recent.slice(0, 8).map((path, i) => ({
        label: path.split(/[/\\]/).filter(Boolean).pop() || path,
        run: () => commands.execute('workspace:open-path', [path]),
        separatorBefore: i === 0,
      })),
      {
        label: 'Close Folder',
        run: () => commands.execute('workspace:close-project'),
        separatorBefore: true,
      },
      {
        label: 'Settings',
        shortcut: 'Ctrl+,',
        run: () => appNavigate('/settings'),
      },
    ],
    Edit: [
      {
        label: 'Command Palette…',
        shortcut: 'Ctrl+Shift+P',
        run: () => commands.togglePalette(true),
      },
      {
        label: 'Settings',
        run: () => appNavigate('/settings'),
        separatorBefore: true,
      },
    ],
    Selection: [
      {
        label: 'Command Palette…',
        run: () => commands.togglePalette(true),
      },
    ],
    View: [
      {
        label: 'Toggle Explorer',
        run: () => shellUiStore.toggleLeft(),
      },
      {
        label: 'Toggle Agent Panel',
        run: () => shellUiStore.toggleRight(),
      },
      {
        label: 'Toggle Panel',
        run: () => shellUiStore.toggleBottom(),
      },
      {
        label: 'Command Palette…',
        shortcut: 'Ctrl+Shift+P',
        run: () => commands.togglePalette(true),
        separatorBefore: true,
      },
    ],
    Go: [
      {
        label: 'Conversation',
        run: () => appNavigate('/conversation'),
      },
      {
        label: 'Editor (IDE)',
        run: () => {
          shellUiStore.setActivity('editor');
          appNavigate('/editor');
        },
      },
      {
        label: 'Workspace',
        run: () => appNavigate('/workspace'),
      },
      {
        label: 'Settings',
        run: () => appNavigate('/settings'),
        separatorBefore: true,
      },
      {
        label: 'PRISM View',
        run: () => commands.execute('view:prism'),
      },
      {
        label: 'Globe View',
        run: () => commands.execute('view:globe'),
      },
    ],
    Run: [
      {
        label: 'Show Execution Graph',
        run: () => {
          shellUiStore.setBottomTab('graph');
          appNavigate('/execution');
        },
      },
      {
        label: 'Show Output',
        run: () => shellUiStore.setBottomTab('output'),
      },
    ],
    Terminal: [
      {
        label: 'Show Terminal Panel',
        shortcut: 'Ctrl+J',
        run: () => shellUiStore.setBottomTab('output'),
      },
      {
        label: 'Toggle Panel',
        run: () => shellUiStore.toggleBottom(),
      },
    ],
    Help: [
      {
        label: 'Command Palette…',
        run: () => commands.togglePalette(true),
      },
      {
        label: 'Open Settings',
        run: () => appNavigate('/settings'),
      },
      {
        label: PRODUCT.nameLong,
        run: () => appNavigate('/'),
        separatorBefore: true,
      },
    ],
  };

  return (
    <header
      className="relative flex h-10 w-full shrink-0 select-none items-center overflow-visible bg-prism-panel pl-3 text-[17px] font-semibold capitalize text-prism-muted"
      data-tauri-drag-region
      data-name="TitleBar"
    >
      <button
        type="button"
        className="prism-focus-ring-sm pointer-events-auto relative z-10 mr-3 flex size-[35px] shrink-0 items-center justify-center rounded opacity-80 hover:opacity-100"
        title={PRODUCT.name}
        onClick={() => {
          appNavigate('/');
        }}
      >
        <img
          src={brandAssets.logo}
          alt={PRODUCT.name}
          className="size-[28px] object-contain opacity-90"
          draggable={false}
        />
      </button>

      <nav
        ref={navRef}
        className="pointer-events-auto flex items-center gap-5"
        aria-label="Main menu"
      >
        {MENU_ORDER.map((label) => {
          const isOpen = openMenu === label;
          const entries = menus[label];
          return (
            <div key={label} className="relative">
              <button
                type="button"
                className={cn(
                  'prism-focus-ring-sm rounded px-0.5 font-manrope text-[17px] font-semibold leading-none text-prism-muted transition-colors hover:text-white',
                  isOpen && 'text-white',
                )}
                onClick={() => setOpenMenu((v) => (v === label ? null : label))}
                onMouseEnter={() => {
                  if (openMenu) setOpenMenu(label);
                }}
                aria-haspopup="menu"
                aria-expanded={isOpen}
              >
                {label}
              </button>
              {isOpen ? (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-50 mt-1 min-w-[240px] rounded-md border border-white/10 bg-prism-panel py-1 shadow-prism-elevated"
                >
                  {entries.map((entry) => (
                    <div key={`${label}-${entry.label}-${entry.shortcut ?? ''}`}>
                      {entry.separatorBefore ? (
                        <div className="my-1 h-px bg-white/10" />
                      ) : null}
                      <MenuItem
                        label={entry.label}
                        shortcut={entry.shortcut}
                        onClick={() => void run(entry.run)}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <MillyWorkspaceMenu />

      {/* Window title — centered in the continuous drag region. */}
      <div className="pointer-events-none hidden min-w-0 flex-1 px-4 md:block" aria-hidden="true">
        <p className="truncate text-center font-manrope text-[12px] font-medium normal-case tracking-[0.01em] text-prism-dim">
          {windowTitle}
        </p>
      </div>

      <div className="pointer-events-auto ml-auto flex h-full shrink-0 items-center">
        <div className="flex items-center pr-2">
          <MillyRenderer />
        </div>
        <WindowControls />
      </div>
    </header>
  );
}

function MenuItem({
  label,
  shortcut,
  title,
  onClick,
}: {
  label: string;
  shortcut?: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      title={title}
      className="prism-focus-ring-sm flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left font-manrope text-[13px] font-medium normal-case text-prism-muted hover:bg-white/5 hover:text-white"
      onClick={onClick}
    >
      <span className="truncate">{label}</span>
      {shortcut ? <span className="shrink-0 text-[11px] text-prism-dim">{shortcut}</span> : null}
    </button>
  );
}
