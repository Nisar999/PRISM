import { useNavigate } from 'react-router-dom';
import prismMark from '@/assets/figma/shell/prism-mark.png';
import { commands } from '@/lib/commands';
import { shellUiStore } from '@/lib/shellUi';
import { cn } from '@/lib/utils';

type KeyToken = string;

interface WelcomeAction {
  label: string;
  keys: KeyToken[];
  run: () => void;
}

function Keycap({ children }: { children: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[19px] min-w-[28px] items-center justify-center rounded-[6px] px-1.5',
        'bg-[#444] font-manrope text-[11px] font-semibold capitalize leading-none text-prism-meta',
      )}
    >
      {children}
    </span>
  );
}

/**
 * Figma 434:2 center welcome — replaces generated LandingHome dashboard.
 */
export function EditorWelcome() {
  const navigate = useNavigate();

  const actions: WelcomeAction[] = [
    {
      label: 'New Agent',
      keys: ['Ctrl', 'Shift', 'L'],
      run: () => {
        shellUiStore.setActivity('agent');
        shellUiStore.setRightTab('chat');
        navigate('/conversation');
      },
    },
    {
      label: 'Show Terminal',
      keys: ['Ctrl', 'J'],
      run: () => {
        shellUiStore.setBottomTab('output');
      },
    },
    {
      label: 'Search Files',
      keys: ['Ctrl', 'P'],
      run: () => commands.togglePalette(true),
    },
    {
      label: 'Open Browser',
      keys: ['Ctrl', 'Shift', 'B'],
      run: () => commands.togglePalette(true),
    },
    {
      label: 'Maximize Chat',
      keys: ['Ctrl', 'Alt', 'E'],
      run: () => {
        shellUiStore.setActivity('agent');
        shellUiStore.setRightTab('chat');
        navigate('/conversation');
      },
    },
    {
      label: 'Add Folder',
      keys: ['Ctrl', 'Alt', 'A'],
      run: () => {
        void commands.execute('workspace:open');
      },
    },
  ];

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-prism-editor"
      data-name="EditorWelcome"
    >
      <img
        src={prismMark}
        alt=""
        className="mb-10 size-[119px] object-contain opacity-30"
        draggable={false}
      />

      <div className="w-[303px] rounded-[9px] bg-[#1e1e1e]/50 px-3 py-3 opacity-90">
        <ul className="space-y-0">
          {actions.map((action) => (
            <li key={action.label}>
              <button
                type="button"
                onClick={action.run}
                className="flex w-full items-center justify-between gap-3 py-[7px] text-left transition-opacity hover:opacity-100 opacity-80"
              >
                <span className="font-manrope text-[17px] font-semibold capitalize leading-none text-prism-muted">
                  {action.label}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {action.keys.map((k, i) => (
                    <span key={`${action.label}-${k}-${i}`} className="flex items-center gap-1">
                      {i > 0 ? (
                        <span className="px-0.5 font-manrope text-[17px] font-semibold text-[#444]">
                          +
                        </span>
                      ) : null}
                      <Keycap>{k}</Keycap>
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
