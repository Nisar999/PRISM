import { PanelTabs } from '@/components/ui/PanelTabs';
import { IconButton } from '@/components/ui/IconButton';
import { shellUiStore, useShellUi, type AgentPanelTab } from '@/lib/shellUi';
import { AgentChatTab } from './agent/AgentChatTab';
import { AgentThoughtsTab } from './agent/AgentThoughtsTab';
import { AgentMemoryTab } from './agent/AgentMemoryTab';
import { AgentContextTab } from './agent/AgentContextTab';
import { X } from 'lucide-react';

const TABS: { id: AgentPanelTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'thoughts', label: 'Thoughts' },
  { id: 'memory', label: 'Memory' },
  { id: 'context', label: 'Context' },
];

/**
 * Agent panel — Chat / Thoughts / Memory / Context.
 * Thoughts replaces the former separate Thought View (panel-only).
 */
export function IntelligenceRail() {
  const shell = useShellUi();

  return (
    <aside
      className="flex h-full w-full shrink-0 flex-col overflow-hidden bg-prism-panel"
      data-name="AgentPanel"
      aria-label="Agent panel"
    >
      <PanelTabs
        tabs={TABS}
        active={shell.rightTab}
        onChange={(id) => shellUiStore.setRightTab(id)}
        trailing={
          <IconButton
            className="ml-auto p-1"
            title="Close agent panel"
            onClick={() => shellUiStore.toggleRight()}
          >
            <X className="h-3.5 w-3.5" />
          </IconButton>
        }
      />

      <div className="min-h-0 flex-1 overflow-hidden p-3 text-sm">
        <div className="h-full min-h-0 overflow-y-auto">
          {shell.rightTab === 'chat' ? <AgentChatTab /> : null}
          {shell.rightTab === 'thoughts' ? <AgentThoughtsTab /> : null}
          {shell.rightTab === 'memory' ? <AgentMemoryTab /> : null}
          {shell.rightTab === 'context' ? <AgentContextTab /> : null}
        </div>
      </div>
    </aside>
  );
}
