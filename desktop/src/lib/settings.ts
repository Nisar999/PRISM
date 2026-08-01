import { useSyncExternalStore } from 'react';
import { Store, notificationStore } from './store';
import { providerManager } from './providers';
import { identityManager, identityStore } from './identity';

// --- Settings Interfaces ---

export interface AppSettings {
  general: {
    autosaveInterval: number; // in seconds
    enableNotifications: boolean;
    debugLogging: boolean;
  };
  providers: {
    preferredProviderId: string;
    /** Preferred model id/name from the active provider catalogue. */
    preferredModel: string;
    ollamaEndpoint: string;
    openaiKey: string;
    anthropicKey: string;
    geminiKey: string;
  };
  /** Appearance / chrome (UI label: Appearance). */
  layout: {
    defaultPanelLayout: 'developer' | 'analytics' | 'minimal';
    sidebarWidth: number; // in pixels
    restoreLastLayout: boolean;
  };
  /** Workspace session — last folder + recents (persisted via settingsManager). */
  workspace: {
    lastPath: string;
    recentFolders: string[];
    restoreOnLaunch: boolean;
  };
  /** Shell chrome sizes/visibility. */
  shell: {
    agentWidth: number;
    bottomHeight: number;
    leftOpen: boolean;
    rightOpen: boolean;
    bottomOpen: boolean;
  };
  /** PRISM center panes (Milly views) — Code-OSS tabs stay in the workbench. */
  session: {
    openPanes: string[];
    activePane: string | null;
  };
  /** Milly cognitive presence + optional voice (settings-gated). */
  milly: {
    animationsEnabled: boolean;
    thinkingAnimation: boolean;
    autoSpeak: boolean;
    voiceEnabled: boolean;
    voiceProviderId: string;
    voiceId: string;
    voiceApiKey: string;
    /** 0–1 */
    volume: number;
    /** 0.5–2 */
    playbackSpeed: number;
    debug: boolean;
  };
}

export const defaultSettings: AppSettings = {
  general: {
    autosaveInterval: 30,
    enableNotifications: true,
    debugLogging: false,
  },
  providers: {
    preferredProviderId: 'ollama',
    preferredModel: '',
    ollamaEndpoint: 'http://localhost:11434',
    openaiKey: '',
    anthropicKey: '',
    geminiKey: '',
  },
  layout: {
    defaultPanelLayout: 'developer',
    sidebarWidth: 256,
    restoreLastLayout: true,
  },
  workspace: {
    lastPath: '',
    recentFolders: [],
    restoreOnLaunch: true,
  },
  shell: {
    agentWidth: 320,
    bottomHeight: 220,
    leftOpen: true,
    rightOpen: true,
    bottomOpen: false,
  },
  session: {
    openPanes: [],
    activePane: null,
  },
  milly: {
    animationsEnabled: true,
    thinkingAnimation: true,
    autoSpeak: false,
    voiceEnabled: false,
    voiceProviderId: 'elevenlabs',
    voiceId: '',
    voiceApiKey: '',
    volume: 0.85,
    playbackSpeed: 1,
    debug: false,
  },
};

// --- Settings Store ---

class SettingsStore extends Store<AppSettings> {
  constructor() {
    super(defaultSettings);
  }

  public setSettings(settings: AppSettings): void {
    this.updateState(settings);
  }
}

export const settingsStore = new SettingsStore();

// --- SettingsManager Service ---

class SettingsManager {
  private STORAGE_KEY = 'prism_app_settings';

  /**
   * Load settings from disk (Tauri config falls back to LocalStorage)
   */
  public async load(): Promise<AppSettings> {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(this.STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as AppSettings;
          const merged = this.mergeDefaults(parsed);
          settingsStore.setSettings(merged);
          notificationStore.setEnabled(merged.general.enableNotifications);
          return merged;
        }
      }
    } catch (err) {
      console.warn('Failed to load settings from storage, using defaults:', err);
    }
    settingsStore.setSettings(defaultSettings);
    notificationStore.setEnabled(defaultSettings.general.enableNotifications);
    return defaultSettings;
  }

  /**
   * Save settings to storage and trigger side-effects in other managers
   */
  public async save(settings: AppSettings): Promise<void> {
    const error = this.validate(settings);
    if (error) {
      throw new Error(`Settings validation failed: ${error}`);
    }

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
      }
      settingsStore.setSettings(settings);
      notificationStore.setEnabled(settings.general.enableNotifications);

      // Side Effect 1: Update preferred provider if changed
      const currentActive = providerManager.getActiveProvider();
      if (!currentActive || currentActive.id !== settings.providers.preferredProviderId) {
        // Run async in background
        providerManager.selectProvider(settings.providers.preferredProviderId, { softFail: true }).catch(() => {});
      }

      // Side Effect 2: Update identity settings
      const identityState = identityStore.getSnapshot().activeIdentity;
      if (identityState && identityState.settings.preferredProviderId !== settings.providers.preferredProviderId) {
        const updated = {
          ...identityState,
          settings: {
            ...identityState.settings,
            preferredProviderId: settings.providers.preferredProviderId,
          },
        };
        await identityManager.saveActiveProfile(updated);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      throw err;
    }
  }

  /**
   * Update a specific configuration option
   */
  public async updateOption<C extends keyof AppSettings, K extends keyof AppSettings[C]>(
    category: C,
    key: K,
    value: AppSettings[C][K]
  ): Promise<void> {
    const current = settingsStore.getSnapshot();
    const updated = {
      ...current,
      [category]: {
        ...current[category],
        [key]: value,
      },
    };
    await this.save(updated);
  }

  /**
   * Validates settings parameters for boundaries
   */
  public validate(settings: AppSettings): string | null {
    if (settings.general.autosaveInterval < 5 || settings.general.autosaveInterval > 600) {
      return 'Autosave interval must be between 5 and 600 seconds.';
    }
    if (settings.layout.sidebarWidth < 180 || settings.layout.sidebarWidth > 480) {
      return 'Sidebar width must be between 180px and 480px.';
    }
    if (!settings.providers.preferredProviderId) {
      return 'Preferred Provider ID cannot be empty.';
    }
    if (settings.milly.volume < 0 || settings.milly.volume > 1) {
      return 'Milly voice volume must be between 0 and 1.';
    }
    if (settings.milly.playbackSpeed < 0.5 || settings.milly.playbackSpeed > 2) {
      return 'Milly playback speed must be between 0.5 and 2.';
    }
    return null;
  }

  /**
   * Export active configuration as portable string
   */
  public export(): string {
    const current = settingsStore.getSnapshot();
    return JSON.stringify({
      schema_version: '1.0',
      exported_at: new Date().toISOString(),
      settings: current,
    }, null, 2);
  }

  /**
   * Import settings from exported configuration bundle
   */
  public async import(jsonString: string): Promise<void> {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || !parsed.settings) {
        throw new Error('Missing settings block in configuration.');
      }
      
      const merged = this.mergeDefaults(parsed.settings);
      await this.save(merged);
      
      notificationStore.addNotification({
        type: 'success',
        message: 'Settings Imported',
        description: 'Applied imported configuration profile successfully.',
      });
    } catch (err: any) {
      notificationStore.addNotification({
        type: 'error',
        message: 'Import Failed',
        description: err.message || 'JSON parse exception during configuration import.',
      });
      throw err;
    }
  }

  /**
   * Helper to merge loaded configurations with defaults to support backward compatibility
   */
  private mergeDefaults(loaded: any): AppSettings {
    return {
      general: { ...defaultSettings.general, ...loaded.general },
      providers: { ...defaultSettings.providers, ...loaded.providers },
      layout: { ...defaultSettings.layout, ...loaded.layout },
      workspace: { ...defaultSettings.workspace, ...loaded.workspace },
      shell: { ...defaultSettings.shell, ...loaded.shell },
      session: {
        ...defaultSettings.session,
        ...loaded.session,
        openPanes: Array.isArray(loaded.session?.openPanes)
          ? loaded.session.openPanes
          : defaultSettings.session.openPanes,
      },
      milly: { ...defaultSettings.milly, ...loaded.milly },
    };
  }

  /**
   * Bootstrap settings load and side effect hydration on launch
   */
  public async bootstrap(): Promise<void> {
    await this.load();
    // Provider activation is owned by providerManager.bootstrap() (avoids duplicate / racing selects).
  }
}

export const settingsManager = new SettingsManager();
export default settingsManager;

// --- React hook ---

export function useSettings(): AppSettings {
  return useSyncExternalStore(
    settingsStore.subscribe.bind(settingsStore),
    settingsStore.getSnapshot.bind(settingsStore)
  );
}
