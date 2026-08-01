import { useNavigate, useLocation } from 'react-router-dom';
import {
  Files,
  Search,
  MessageSquare,
  Code2,
  Settings,
  PanelBottom,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { shellUiStore, useShellUi, type ActivityId } from '@/lib/shellUi';
import { notificationStore } from '@/lib/store';

const ITEMS: {
  id: ActivityId | 'terminal' | 'execution';
  title: string;
  icon: typeof Files;
  action: 'activity' | 'ide' | 'route' | 'execution' | 'agent';
  route?: string;
}[] = [
  { id: 'explorer', title: 'Workspace', icon: Files, action: 'activity' },
  { id: 'search', title: 'Search (Code-OSS)', icon: Search, action: 'ide' },
  { id: 'agent', title: 'Agent', icon: MessageSquare, action: 'agent' },
  { id: 'editor', title: 'Editor (Code-OSS)', icon: Code2, action: 'ide' },
  { id: 'terminal', title: 'Terminal (Code-OSS)', icon: PanelBottom, action: 'ide' },
  { id: 'execution', title: 'Execution output', icon: Workflow, action: 'execution' },
  { id: 'settings', title: 'Settings', icon: Settings, action: 'route', route: '/settings' },
];

/**
 * Figma 434:2 ActivityBar — fixed 52px rail.
 * IDE surfaces (Search / Editor / Terminal) open Code-OSS at `/editor`.
 * Explorer here is PRISM workspace intelligence, not a VS Code file-tree duplicate.
 */
export function ActivityBar() {
  const shell = useShellUi();
  const navigate = useNavigate();
  const location = useLocation();
  const onEditor = location.pathname.startsWith('/editor');

  return (
    <aside
      className="flex h-full w-[52px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.06] bg-prism-panel py-2"
      data-name="ActivityBar"
      aria-label="Activity bar"
    >
      {ITEMS.map((item) => {
        const active =
          item.action === 'activity'
            ? shell.activity === item.id && shell.leftOpen
            : item.action === 'execution'
              ? shell.bottomOpen
              : item.action === 'agent'
                ? shell.rightOpen && location.pathname.startsWith('/conversation')
                : item.action === 'ide'
                  ? onEditor
                  : item.action === 'route' && item.route
                    ? location.pathname.startsWith(item.route)
                    : false;

        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            title={item.title}
            aria-label={item.title}
            aria-pressed={active}
            className={cn(
              'relative flex size-10 items-center justify-center rounded-control text-prism-meta transition-colors',
              'hover:text-white',
              active && 'bg-prism-fill text-white',
            )}
            onClick={() => {
              if (item.action === 'ide') {
                shellUiStore.setActivity('editor');
                navigate('/editor');
                if (item.id === 'search' || item.id === 'terminal') {
                  notificationStore.addNotification({
                    type: 'info',
                    message: item.id === 'search' ? 'Code-OSS Search' : 'Code-OSS Terminal',
                    description:
                      item.id === 'search'
                        ? 'Use Ctrl+Shift+F inside the editing engine for Search.'
                        : 'Use Ctrl+` inside the editing engine for Terminal. Problems: View → Problems.',
                  });
                }
                return;
              }
              if (item.action === 'execution') {
                shellUiStore.toggleBottom();
                if (!shell.bottomOpen) shellUiStore.setBottomTab('output');
                return;
              }
              if (item.action === 'route' && item.route) {
                shellUiStore.setActivity(item.id as ActivityId);
                navigate(item.route);
                return;
              }
              if (item.action === 'agent') {
                shellUiStore.setActivity('agent');
                shellUiStore.setRightTab('chat');
                navigate('/conversation');
                return;
              }
              if (item.id === 'explorer') {
                if (shell.activity === 'explorer' && shell.leftOpen) {
                  shellUiStore.toggleLeft();
                } else {
                  shellUiStore.setActivity('explorer');
                }
              }
            }}
          >
            {active ? (
              <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-prism-focus" />
            ) : null}
            <Icon className="h-[22px] w-[22px]" strokeWidth={1.5} />
          </button>
        );
      })}
    </aside>
  );
}
