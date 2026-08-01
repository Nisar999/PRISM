/**
 * Shell UI state — IDE chrome visibility + panel sizes (Figma 434:2).
 * Complements LayoutManager docks; does not replace layout engine logic.
 */

import { useSyncExternalStore } from 'react';
import { Store } from './store';

export type ActivityId = 'explorer' | 'search' | 'agent' | 'editor' | 'settings';

/** Agent panel (IntelligenceRail) tabs — Thoughts lives here, not a separate screen. */
export type AgentPanelTab = 'chat' | 'thoughts' | 'memory' | 'context';

export interface ShellUiState {
  leftOpen: boolean;
  rightOpen: boolean;
  bottomOpen: boolean;
  rightTab: AgentPanelTab;
  bottomTab: 'graph' | 'output' | 'review';
  activity: ActivityId;
  sidebarWidth: number;
  agentWidth: number;
  bottomHeight: number;
}

const SIDEBAR_DEFAULT = 220;
const AGENT_DEFAULT = 320;
const BOTTOM_DEFAULT = 220;
const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 420;
const AGENT_MIN = 240;
const AGENT_MAX = 480;
const BOTTOM_MIN = 120;
const BOTTOM_MAX = 480;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

class ShellUiStore extends Store<ShellUiState> {
  constructor() {
    super({
      leftOpen: true,
      rightOpen: true,
      bottomOpen: false,
      rightTab: 'chat',
      bottomTab: 'output',
      activity: 'explorer',
      sidebarWidth: SIDEBAR_DEFAULT,
      agentWidth: AGENT_DEFAULT,
      bottomHeight: BOTTOM_DEFAULT,
    });
  }

  toggleLeft(): void {
    this.updateState((s) => ({ ...s, leftOpen: !s.leftOpen }));
  }

  toggleRight(): void {
    this.updateState((s) => ({ ...s, rightOpen: !s.rightOpen }));
  }

  toggleBottom(): void {
    this.updateState((s) => ({ ...s, bottomOpen: !s.bottomOpen }));
  }

  setRightTab(tab: ShellUiState['rightTab']): void {
    this.updateState({ rightTab: tab, rightOpen: true, activity: 'agent' });
  }

  setBottomTab(tab: ShellUiState['bottomTab']): void {
    this.updateState({ bottomTab: tab, bottomOpen: true });
  }

  setActivity(activity: ActivityId): void {
    this.updateState((s) => {
      const next: Partial<ShellUiState> = { activity };
      if (activity === 'explorer') next.leftOpen = true;
      if (activity === 'agent') next.rightOpen = true;
      if (activity === 'search') {
        /* palette opened by caller */
      }
      return { ...s, ...next };
    });
  }

  setSidebarWidth(width: number): void {
    this.updateState({ sidebarWidth: clamp(width, SIDEBAR_MIN, SIDEBAR_MAX) });
  }

  setAgentWidth(width: number): void {
    this.updateState({ agentWidth: clamp(width, AGENT_MIN, AGENT_MAX) });
  }

  setBottomHeight(height: number): void {
    this.updateState({ bottomHeight: clamp(height, BOTTOM_MIN, BOTTOM_MAX) });
  }

  /** Hydrate chrome from persisted settings (session restore). */
  hydrate(partial: Partial<ShellUiState>): void {
    this.updateState((s) => ({
      ...s,
      ...partial,
      sidebarWidth:
        partial.sidebarWidth !== undefined
          ? clamp(partial.sidebarWidth, SIDEBAR_MIN, SIDEBAR_MAX)
          : s.sidebarWidth,
      agentWidth:
        partial.agentWidth !== undefined
          ? clamp(partial.agentWidth, AGENT_MIN, AGENT_MAX)
          : s.agentWidth,
      bottomHeight:
        partial.bottomHeight !== undefined
          ? clamp(partial.bottomHeight, BOTTOM_MIN, BOTTOM_MAX)
          : s.bottomHeight,
    }));
  }

  collapseContextualPanels(): void {
    this.updateState({ rightOpen: false, bottomOpen: false });
  }
}

export const shellUiStore = new ShellUiStore();

export function useShellUi(): ShellUiState {
  return useSyncExternalStore(
    shellUiStore.subscribe.bind(shellUiStore),
    shellUiStore.getSnapshot.bind(shellUiStore),
  );
}
