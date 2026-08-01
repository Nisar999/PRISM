import { Store, notificationStore } from './store';

// --- Type Definitions matching Workspace Layout canonical specs ---

export type SplitDirection = 'horizontal' | 'vertical';

export interface LayoutNode {
  type: 'container' | 'pane';
  id: string;
}

export interface ContainerNode extends LayoutNode {
  type: 'container';
  direction: SplitDirection;
  sizes: number[]; // Ratios of child elements (e.g. [50, 50])
  children: (ContainerNode | PaneNode)[];
}

export interface PaneNode extends LayoutNode {
  type: 'pane';
  activePanelId: string | null;
  panelIds: string[];
}

export interface FloatingWindow {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layout: ContainerNode | PaneNode;
}

export interface WorkspaceLayout {
  id: string;
  name: string;
  root: ContainerNode | PaneNode;
  floatingWindows: FloatingWindow[];
  docks: {
    left: PaneNode | null;
    right: PaneNode | null;
    bottom: PaneNode | null;
  };
}

export interface PanelDefinition {
  id: string;
  title: string;
  componentType: string;
  defaultSize?: number;
  isResizable?: boolean;
  isUnique?: boolean;
}

// --- Platform-Agnostic File Wrapper ---

async function checkIsTauri(): Promise<boolean> {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

async function tauriInvoke<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  const isTauri = await checkIsTauri();
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  }
  
  // Browser fallback
  switch (cmd) {
    case 'read_file_string': {
      const data = localStorage.getItem(`fs:${args.path}`);
      if (data === null || data === undefined) {
        throw new Error(`File not found: ${args.path}`);
      }
      return data as unknown as T;
    }
    case 'write_file_string': {
      localStorage.setItem(`fs:${args.path}`, args.content || '');
      return null as unknown as T;
    }
    default:
      throw new Error(`Unknown mock FS command: ${cmd}`);
  }
}

// --- Layout Store (UI-Agnostic) ---

export interface LayoutState {
  activeLayout: WorkspaceLayout | null;
  registeredPanels: PanelDefinition[];
  savedLayouts: Record<string, WorkspaceLayout>;
}

class LayoutStore extends Store<LayoutState> {
  constructor() {
    super({
      activeLayout: null,
      registeredPanels: [],
      savedLayouts: {},
    });
  }

  public registerPanel(panel: PanelDefinition): void {
    this.updateState(state => {
      if (state.registeredPanels.some(p => p.id === panel.id)) {
        return state;
      }
      return {
        ...state,
        registeredPanels: [...state.registeredPanels, panel],
      };
    });
  }

  public unregisterPanel(panelId: string): void {
    this.updateState(state => ({
      ...state,
      registeredPanels: state.registeredPanels.filter(p => p.id !== panelId),
    }));
  }

  public setActiveLayout(layout: WorkspaceLayout | null): void {
    this.updateState({ activeLayout: layout });
  }

  public setSavedLayouts(layouts: Record<string, WorkspaceLayout>): void {
    this.updateState({ savedLayouts: layouts });
  }
}

export const layoutStore = new LayoutStore();

// --- LayoutManager Implementation ---

class LayoutManager {
  private layoutFilePath = 'layouts.json';

  constructor() {
    // Register default panels outlined in UI_DESIGN_LANGUAGE
    this.registerPanel({ id: 'dashboard', title: 'Cognitive Pipeline', componentType: 'Dashboard', isUnique: true });
    this.registerPanel({ id: 'editor', title: 'Code Editor', componentType: 'Editor' });
    this.registerPanel({ id: 'terminal', title: 'System Terminal', componentType: 'Terminal' });
    this.registerPanel({ id: 'graph', title: 'Execution Graph', componentType: 'Graph', isUnique: true });
    this.registerPanel({ id: 'settings', title: 'System Settings', componentType: 'Settings', isUnique: true });
  }

  public registerPanel(panel: PanelDefinition): void {
    layoutStore.registerPanel(panel);
  }

  public unregisterPanel(panelId: string): void {
    layoutStore.unregisterPanel(panelId);
  }

  /**
   * Helper to generate a default layout structure
   */
  public generateDefaultLayout(id = 'default', name = 'Default Layout'): WorkspaceLayout {
    return {
      id,
      name,
      root: {
        type: 'container',
        id: 'root-split',
        direction: 'horizontal',
        sizes: [30, 70],
        children: [
          {
            type: 'pane',
            id: 'left-pane',
            activePanelId: 'graph',
            panelIds: ['graph'],
          },
          {
            type: 'container',
            id: 'right-split',
            direction: 'vertical',
            sizes: [60, 40],
            children: [
              {
                type: 'pane',
                id: 'main-pane',
                activePanelId: 'dashboard',
                panelIds: ['dashboard', 'editor'],
              },
              {
                type: 'pane',
                id: 'bottom-pane',
                activePanelId: 'terminal',
                panelIds: ['terminal'],
              }
            ]
          }
        ]
      },
      floatingWindows: [],
      docks: {
        left: null,
        right: null,
        bottom: null,
      }
    };
  }

  /**
   * Load layouts from disk or fallback to default
   */
  public async loadLayouts(projectId: string): Promise<WorkspaceLayout> {
    const path = `projects/${projectId}/${this.layoutFilePath}`;
    try {
      const content = await tauriInvoke<string>('read_file_string', { path });
      const data = JSON.parse(content);
      layoutStore.setSavedLayouts(data.savedLayouts || {});
      
      const active = data.activeLayout || this.generateDefaultLayout();
      layoutStore.setActiveLayout(active);
      return active;
    } catch (err) {
      // Return default layout if file does not exist
      const defaultLayout = this.generateDefaultLayout();
      layoutStore.setActiveLayout(defaultLayout);
      return defaultLayout;
    }
  }

  /**
   * Save layout configuration to disk
   */
  public async saveLayouts(projectId: string): Promise<void> {
    const activeLayout = layoutStore.getSnapshot().activeLayout;
    if (!activeLayout) return;

    const path = `projects/${projectId}/${this.layoutFilePath}`;
    const payload = {
      activeLayout,
      savedLayouts: layoutStore.getSnapshot().savedLayouts,
    };

    try {
      await tauriInvoke('write_file_string', {
        path,
        content: JSON.stringify(payload, null, 2),
      });
      notificationStore.addNotification({
        type: 'success',
        message: 'Layout Saved',
        description: 'Workspace pane arrangement preserved.',
      });
    } catch (err: any) {
      console.error('Failed to save layout configs:', err);
      notificationStore.addNotification({
        type: 'error',
        message: 'Layout Save Failed',
        description: err.message || String(err),
      });
    }
  }

  /**
   * Split a leaf pane to insert a new panel
   */
  public splitPane(paneId: string, direction: SplitDirection, panelId: string): void {
    const activeLayout = layoutStore.getSnapshot().activeLayout;
    if (!activeLayout) return;

    const updatedRoot = this.traverseAndSplit(activeLayout.root, paneId, direction, panelId);
    layoutStore.setActiveLayout({
      ...activeLayout,
      root: updatedRoot,
    });
  }

  /**
   * Close a panel within a leaf pane
   */
  public closePanel(paneId: string, panelId: string): void {
    const activeLayout = layoutStore.getSnapshot().activeLayout;
    if (!activeLayout) return;

    const updatedRoot = this.traverseAndClose(activeLayout.root, paneId, panelId);
    if (updatedRoot) {
      layoutStore.setActiveLayout({
        ...activeLayout,
        root: updatedRoot,
      });
    }
  }

  /**
   * Dock a panel to a specific side (left, right, bottom)
   */
  public dockPanel(panelId: string, target: 'left' | 'right' | 'bottom'): void {
    const activeLayout = layoutStore.getSnapshot().activeLayout;
    if (!activeLayout) return;

    const updatedDocks = { ...activeLayout.docks };
    const currentDock = updatedDocks[target];

    if (currentDock) {
      if (!currentDock.panelIds.includes(panelId)) {
        currentDock.panelIds.push(panelId);
      }
      currentDock.activePanelId = panelId;
    } else {
      updatedDocks[target] = {
        type: 'pane',
        id: `dock-${target}`,
        activePanelId: panelId,
        panelIds: [panelId],
      };
    }

    layoutStore.setActiveLayout({
      ...activeLayout,
      docks: updatedDocks,
    });
  }

  /**
   * Undock a panel from a side dock
   */
  public undockPanel(panelId: string, target: 'left' | 'right' | 'bottom'): void {
    const activeLayout = layoutStore.getSnapshot().activeLayout;
    if (!activeLayout) return;

    const updatedDocks = { ...activeLayout.docks };
    const currentDock = updatedDocks[target];

    if (currentDock) {
      currentDock.panelIds = currentDock.panelIds.filter(id => id !== panelId);
      if (currentDock.panelIds.length === 0) {
        updatedDocks[target] = null;
      } else if (currentDock.activePanelId === panelId) {
        currentDock.activePanelId = currentDock.panelIds[0];
      }
    }

    layoutStore.setActiveLayout({
      ...activeLayout,
      docks: updatedDocks,
    });
  }

  /**
   * Detach panel to a new floating window frame
   */
  public detachPanel(panelId: string, title: string, x: number, y: number, width: number, height: number): void {
    const activeLayout = layoutStore.getSnapshot().activeLayout;
    if (!activeLayout) return;

    const windowId = `win-${Math.random().toString(36).substring(2, 9)}`;
    const floatingWindow: FloatingWindow = {
      id: windowId,
      title,
      x,
      y,
      width,
      height,
      layout: {
        type: 'pane',
        id: `pane-${windowId}`,
        activePanelId: panelId,
        panelIds: [panelId],
      }
    };

    layoutStore.setActiveLayout({
      ...activeLayout,
      floatingWindows: [...activeLayout.floatingWindows, floatingWindow],
    });
  }

  /**
   * Close a floating window
   */
  public closeFloatingWindow(windowId: string): void {
    const activeLayout = layoutStore.getSnapshot().activeLayout;
    if (!activeLayout) return;

    layoutStore.setActiveLayout({
      ...activeLayout,
      floatingWindows: activeLayout.floatingWindows.filter(w => w.id !== windowId),
    });
  }

  // --- Internals / Tree Traversal algorithms ---

  private traverseAndSplit(
    node: ContainerNode | PaneNode,
    paneId: string,
    direction: SplitDirection,
    panelId: string
  ): ContainerNode | PaneNode {
    if (node.type === 'pane') {
      if (node.id === paneId) {
        const newPaneId = `pane-${Math.random().toString(36).substring(2, 9)}`;
        const leftChild: PaneNode = { ...node };
        const rightChild: PaneNode = {
          type: 'pane',
          id: newPaneId,
          activePanelId: panelId,
          panelIds: [panelId],
        };

        return {
          type: 'container',
          id: `split-${Math.random().toString(36).substring(2, 9)}`,
          direction,
          sizes: [50, 50],
          children: [leftChild, rightChild],
        };
      }
      return node;
    }

    return {
      ...node,
      children: node.children.map(child => this.traverseAndSplit(child, paneId, direction, panelId)),
    };
  }

  private traverseAndClose(
    node: ContainerNode | PaneNode,
    paneId: string,
    panelId: string
  ): ContainerNode | PaneNode | null {
    if (node.type === 'pane') {
      if (node.id === paneId) {
        const nextPanelIds = node.panelIds.filter(id => id !== panelId);
        if (nextPanelIds.length === 0) {
          return null; // Empty pane, signal parent to collapse
        }
        return {
          ...node,
          panelIds: nextPanelIds,
          activePanelId: node.activePanelId === panelId ? nextPanelIds[0] : node.activePanelId,
        };
      }
      return node;
    }

    const nextChildren: (ContainerNode | PaneNode)[] = [];
    const nextSizes: number[] = [];

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const updatedChild = this.traverseAndClose(child, paneId, panelId);
      
      if (updatedChild) {
        nextChildren.push(updatedChild);
        nextSizes.push(node.sizes[i] || (100 / node.children.length));
      }
    }

    if (nextChildren.length === 0) {
      return null;
    }

    if (nextChildren.length === 1) {
      // Collapse redundant split container
      return nextChildren[0];
    }

    return {
      ...node,
      sizes: nextSizes,
      children: nextChildren,
    };
  }
}

export const layoutManager = new LayoutManager();
export default layoutManager;
