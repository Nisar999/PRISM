import { useSyncExternalStore } from 'react';
import { Store, notificationStore } from './store';
import { commands, CommandDefinition } from './commands';
import { toolManager, ToolDefinition } from './tools';
import { providerManager, ProviderDefinition } from './providers';
import { layoutManager, PanelDefinition } from './layout';

// --- Type Definitions for Plugin SDK ---

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
}

export interface PluginContext {
  manifest: PluginManifest;
  registerCommand: (cmd: CommandDefinition) => () => void;
  registerTool: (tool: ToolDefinition) => () => void;
  registerProvider: (provider: ProviderDefinition) => () => void;
  registerPanel: (panel: PanelDefinition) => () => void;
  addNotification: (message: string, description?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export interface IPlugin {
  onRegister?: (ctx: PluginContext) => void;
  onStart?: (ctx: PluginContext) => void;
  onStop?: (ctx: PluginContext) => void;
}

export interface PluginItem {
  manifest: PluginManifest;
  status: 'loaded' | 'started' | 'stopped' | 'error';
  instance: IPlugin;
  error?: string;
}

// --- Plugin Store ---

export interface PluginState {
  plugins: Record<string, PluginItem>;
}

class PluginStore extends Store<PluginState> {
  constructor() {
    super({
      plugins: {},
    });
  }

  public registerPlugin(item: PluginItem): void {
    this.updateState(state => ({
      ...state,
      plugins: {
        ...state.plugins,
        [item.manifest.id]: item,
      },
    }));
  }

  public updatePluginStatus(
    pluginId: string, 
    status: PluginItem['status'], 
    error?: string
  ): void {
    this.updateState(state => {
      const current = state.plugins[pluginId];
      if (!current) return state;

      return {
        ...state,
        plugins: {
          ...state.plugins,
          [pluginId]: { ...current, status, error },
        },
      };
    });
  }

  public removePlugin(pluginId: string): void {
    this.updateState(state => {
      const copy = { ...state.plugins };
      delete copy[pluginId];
      return {
        ...state,
        plugins: copy,
      };
    });
  }
}

export const pluginStore = new PluginStore();

// --- PluginManager Service ---

class PluginManager {
  // Keep track of active cleanups returned by registers during register lifecycle
  private cleanups: Map<string, Array<() => void>> = new Map();

  /**
   * Load and initialize a plugin instance
   */
  public loadPlugin(manifest: PluginManifest, pluginInstance: IPlugin): void {
    const pluginId = manifest.id;
    if (pluginStore.getSnapshot().plugins[pluginId]) {
      console.warn(`Plugin "${pluginId}" is already loaded.`);
      return;
    }

    const cleanupsList: Array<() => void> = [];
    this.cleanups.set(pluginId, cleanupsList);

    // Create localized context wrapper for the plugin SDK
    const context: PluginContext = {
      manifest,
      registerCommand: (cmd) => {
        const unregister = commands.register(cmd);
        cleanupsList.push(unregister);
        return unregister;
      },
      registerTool: (tool) => {
        toolManager.registerTool(tool);
        const unregister = () => {
          toolManager.unregisterTool(tool.id);
        };
        cleanupsList.push(unregister);
        return unregister;
      },
      registerProvider: (provider) => {
        providerManager.registerProvider(provider);
        const unregister = () => {
          providerManager.unregisterProvider(provider.id);
        };
        cleanupsList.push(unregister);
        return unregister;
      },
      registerPanel: (panel) => {
        layoutManager.registerPanel(panel);
        const unregister = () => {
          layoutManager.unregisterPanel(panel.id);
        };
        cleanupsList.push(unregister);
        return unregister;
      },
      addNotification: (message, description, type = 'info') => {
        notificationStore.addNotification({
          type,
          message: `[Plugin: ${manifest.name}] ${message}`,
          description,
        });
      },
    };

    // Register details in store
    pluginStore.registerPlugin({
      manifest,
      status: 'loaded',
      instance: pluginInstance,
    });

    try {
      // 1. Run register hook
      if (pluginInstance.onRegister) {
        pluginInstance.onRegister(context);
      }

      // 2. Run start hook
      if (pluginInstance.onStart) {
        pluginInstance.onStart(context);
      }

      pluginStore.updatePluginStatus(pluginId, 'started');

      const loadMessage =
        pluginId === 'prism-git-helper' ? 'Git Assistant Ready' : `${manifest.name} ready`;
      const loadDescription =
        pluginId === 'prism-git-helper'
          ? 'Git panels and commands are available in the shell.'
          : `Capability plugin ${manifest.name} v${manifest.version} is running.`;

      notificationStore.addNotification({
        type: 'success',
        message: loadMessage,
        description: loadDescription,
      });
    } catch (err: any) {
      console.error(`Failed to activate plugin ${pluginId}:`, err);
      pluginStore.updatePluginStatus(pluginId, 'error', err.message || String(err));
      
      // Perform fallback cleanups on error
      this.unloadPlugin(pluginId);
    }
  }

  /**
   * Unloads plugin, triggers stop hooks, and clears registered capabilities
   */
  public unloadPlugin(pluginId: string): void {
    const item = pluginStore.getSnapshot().plugins[pluginId];
    if (!item) return;

    try {
      if (item.status === 'started' && item.instance.onStop) {
        // Trigger stop lifecycle hook
        const contextDummy = { manifest: item.manifest } as PluginContext;
        item.instance.onStop(contextDummy);
      }
    } catch (err) {
      console.warn(`Error during onStop for plugin ${pluginId}:`, err);
    }

    // Execute cleanups registered by SDK helpers
    const activeCleanups = this.cleanups.get(pluginId);
    if (activeCleanups) {
      activeCleanups.forEach(clean => {
        try {
          clean();
        } catch (err) {
          console.error('Failed cleaning capability during plugin unload:', err);
        }
      });
      this.cleanups.delete(pluginId);
    }

    pluginStore.removePlugin(pluginId);

    notificationStore.addNotification({
      type: 'warning',
      message: 'Plugin Unloaded',
      description: `Unloaded plugin and unregistered all bounds for: ${item.manifest.name}`,
    });
  }

  /**
   * Helper to retrieve all loaded plugins
   */
  public getPlugins(): PluginItem[] {
    return Object.values(pluginStore.getSnapshot().plugins);
  }

  /**
   * Bootstrap local developer plugins to demonstrate SDK registers
   */
  public bootstrap(): void {
    // Register Mock Local Git Helper Plugin
    this.loadPlugin(
      {
        id: 'prism-git-helper',
        name: 'PRISM Git Assistant',
        version: '1.0.0',
        description: 'Registers Git checkout helper capabilities and layout panels.',
        author: 'PRISM Core Devs',
      },
      {
        onRegister(ctx) {
          // Register a Custom panel
          ctx.registerPanel({
            id: 'git-panel',
            title: 'Git Repository',
            componentType: 'Placeholder', // Falls back to standard view
          });

          // Register a Custom command
          ctx.registerCommand({
            id: 'system:git-plugin-status', // Correct CommandCategory ('system')
            name: 'Check Git Plugin Status',
            category: 'system',
            description: 'Queries loaded Git plugin boundaries.',
            action: () => {
              ctx.addNotification('Active!', 'Git Assistant plugin endpoints verified.', 'success');
            },
          });
        },
        onStart(ctx) {
          ctx.addNotification('Git hooks mounted.', 'Subscribed to local git checkout events.', 'info');
        },
        onStop() {
          /* plugin teardown — no console noise in RC */
        },
      }
    );
  }
}

export const pluginManager = new PluginManager();
export default pluginManager;

// --- React hook ---

export function usePlugins(): PluginState {
  return useSyncExternalStore(
    pluginStore.subscribe.bind(pluginStore),
    pluginStore.getSnapshot.bind(pluginStore)
  );
}
