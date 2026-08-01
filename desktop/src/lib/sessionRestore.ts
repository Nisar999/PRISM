/**
 * Session restore helpers — uses settingsManager + existing open-workspace workflow.
 * No new managers/stores.
 */

import { settingsManager, settingsStore } from './settings';
import { shellUiStore } from './shellUi';
import { workspaceStore } from './store';

const RECENT_MAX = 12;

/** Persist last path + recent list after a successful open. */
export async function rememberWorkspacePath(path: string): Promise<void> {
  const normalized = path.replace(/\//g, '\\');
  const current = settingsStore.getSnapshot();
  const recent = [
    normalized,
    ...current.workspace.recentFolders.filter(
      (p) => p.replace(/\//g, '\\').toLowerCase() !== normalized.toLowerCase(),
    ),
  ].slice(0, RECENT_MAX);

  await settingsManager.save({
    ...current,
    workspace: {
      ...current.workspace,
      lastPath: normalized,
      recentFolders: recent,
    },
  });
}

/** Clear last workspace (Close Project). */
export async function clearLastWorkspace(): Promise<void> {
  const current = settingsStore.getSnapshot();
  await settingsManager.save({
    ...current,
    workspace: {
      ...current.workspace,
      lastPath: '',
    },
  });
}

/** Hydrate shell chrome sizes/visibility from settings. */
export function hydrateShellFromSettings(): void {
  const { layout, shell } = settingsStore.getSnapshot();
  shellUiStore.hydrate({
    sidebarWidth: layout.sidebarWidth || undefined,
    agentWidth: shell.agentWidth || undefined,
    bottomHeight: shell.bottomHeight || undefined,
    leftOpen: shell.leftOpen,
    rightOpen: shell.rightOpen,
    bottomOpen: shell.bottomOpen,
  });
}

/** Persist shell chrome (debounced by caller). */
export async function persistShellLayout(): Promise<void> {
  const snap = shellUiStore.getSnapshot();
  const current = settingsStore.getSnapshot();
  if (!current.layout.restoreLastLayout) return;
  await settingsManager.save({
    ...current,
    layout: {
      ...current.layout,
      sidebarWidth: snap.sidebarWidth,
    },
    shell: {
      agentWidth: snap.agentWidth,
      bottomHeight: snap.bottomHeight,
      leftOpen: snap.leftOpen,
      rightOpen: snap.rightOpen,
      bottomOpen: snap.bottomOpen,
    },
    session: {
      ...current.session,
      openPanes: workspaceStore.getSnapshot().openPanes,
      activePane: workspaceStore.getSnapshot().activePane,
    },
  });
}

/** Restore PRISM editor tabs (Milly views), not Code-OSS tabs. */
export function hydrateOpenPanesFromSettings(): void {
  const { session } = settingsStore.getSnapshot();
  for (const pane of session.openPanes) {
    workspaceStore.openPane(pane);
  }
  if (session.activePane) {
    workspaceStore.setActivePane(session.activePane);
  }
}

/** Best-effort restore last workspace on cold start. */
export async function restoreLastWorkspaceIfEnabled(): Promise<void> {
  const { workspace } = settingsStore.getSnapshot();
  if (!workspace.restoreOnLaunch || !workspace.lastPath.trim()) return;

  const { runOpenWorkspaceWorkflow } = await import('./workflows/openWorkspace');
  const path = workspace.lastPath.trim();
  const name = path.split(/[/\\]/).filter(Boolean).pop() || 'Workspace';
  try {
    await runOpenWorkspaceWorkflow({
      path,
      createIfMissing: { name, tags: ['restored'] },
      summarize: false,
    });
  } catch (err) {
    console.warn('Failed to restore last workspace:', err);
  }
}
