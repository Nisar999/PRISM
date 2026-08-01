import { useSyncExternalStore } from 'react';
import { Store, notificationStore } from './store';
import { api } from './api';
import { identityManager, identityStore } from './identity';
import { debugLog, debugWarn } from './debug';

// --- Type Definitions matching LLM Provider specs ---

export interface ProviderDefinition {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  status: 'active' | 'inactive' | 'error' | 'checking';
  capabilities: string[];
  models: string[];
  latency?: number;
  error?: string;
}

// --- Provider Store (UI-Agnostic) ---

export interface ProviderState {
  providers: Record<string, ProviderDefinition>;
  activeProviderId: string | null;
  isChecking: boolean;
}

class ProviderStore extends Store<ProviderState> {
  constructor() {
    super({
      providers: {},
      activeProviderId: null,
      isChecking: false,
    });
  }

  public registerProvider(provider: ProviderDefinition): void {
    this.updateState(state => ({
      ...state,
      providers: {
        ...state.providers,
        [provider.id]: provider,
      },
    }));
  }

  public setActiveProvider(providerId: string | null): void {
    this.updateState({ activeProviderId: providerId });
  }

  public updateProvider(
    providerId: string, 
    update: Partial<Omit<ProviderDefinition, 'id'>>
  ): void {
    this.updateState(state => {
      const current = state.providers[providerId];
      if (!current) return state;

      return {
        ...state,
        providers: {
          ...state.providers,
          [providerId]: { ...current, ...update },
        },
      };
    });
  }

  public setChecking(isChecking: boolean): void {
    this.updateState({ isChecking });
  }

  public unregisterProvider(providerId: string): void {
    this.updateState(state => {
      const copy = { ...state.providers };
      delete copy[providerId];
      return {
        ...state,
        providers: copy,
      };
    });
  }
}

export const providerStore = new ProviderStore();

const PROVIDER_HEALTH_TIMEOUT_MS = 8000;

function providerDebug(step: string, detail: Record<string, unknown>): void {
  debugLog(step, detail);
}

const SETTINGS_STORAGE_KEY = 'prism_app_settings';

function readOllamaEndpointFromStorage(): string | undefined {
  try {
    if (typeof window === 'undefined') return undefined;
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { providers?: { ollamaEndpoint?: string } };
    return parsed.providers?.ollamaEndpoint?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function ollamaProbeBases(): string[] {
  const fromEnv = (import.meta.env.VITE_OLLAMA_BASE_URL as string | undefined)?.trim();
  const fromSettings = readOllamaEndpointFromStorage();
  const bases = [
    fromEnv,
    fromSettings,
    'http://127.0.0.1:11434',
    'http://127.0.0.1:11435',
    'http://localhost:11434',
    'http://localhost:11435',
  ].filter(Boolean) as string[];
  return [...new Set(bases.map((b) => b.replace(/\/$/, '')))];
}

/** Common LM Studio default ports + env override. */
function lmStudioProbeBases(): string[] {
  const fromEnv = (import.meta.env.VITE_LMSTUDIO_BASE_URL as string | undefined)?.trim();
  const bases = [
    fromEnv,
    'http://127.0.0.1:1234',
    'http://localhost:1234',
  ].filter(Boolean) as string[];
  return [...new Set(bases.map((b) => b.replace(/\/$/, '')))];
}

/** User-configured generic OpenAI-compatible endpoints (comma-separated env). */
function openAiCompatibleBases(): string[] {
  const raw = (import.meta.env.VITE_OPENAI_COMPATIBLE_ENDPOINTS as string | undefined)?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

async function fetchWithTimeout(url: string, timeoutMs = PROVIDER_HEALTH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probeOllamaEndpoint(): Promise<{ healthy: boolean; latency_ms?: number; base?: string }> {
  const bases = ollamaProbeBases();
  providerDebug('ollama.probe.start', { bases, timeoutMs: PROVIDER_HEALTH_TIMEOUT_MS });

  for (const base of bases) {
    const url = `${base}/api/tags`;
    const start = performance.now();
    try {
      const res = await fetchWithTimeout(url);
      const bodyPreview = res.ok ? '(ok)' : await res.text().catch(() => '');
      providerDebug('ollama.probe.response', {
        url,
        status: res.status,
        ok: res.ok,
        bodyPreview: typeof bodyPreview === 'string' ? bodyPreview.slice(0, 200) : bodyPreview,
      });
      if (res.ok) {
        return {
          healthy: true,
          latency_ms: Math.round(performance.now() - start),
          base,
        };
      }
    } catch (err: any) {
      providerDebug('ollama.probe.error', {
        url,
        error: err?.message || String(err),
        name: err?.name,
      });
    }
  }
  providerDebug('ollama.probe.failed', { bases });
  return { healthy: false };
}

/** Fetch the list of installed model names from an Ollama `/api/tags` endpoint. */
async function fetchOllamaModels(base: string): Promise<string[]> {
  try {
    const res = await fetchWithTimeout(`${base}/api/tags`);
    if (!res.ok) return [];
    const body = (await res.json()) as { models?: Array<{ name?: string }> };
    return (body.models ?? [])
      .map((m) => m.name)
      .filter((n): n is string => typeof n === 'string' && n.length > 0);
  } catch {
    return [];
  }
}

/** Probe an OpenAI-compatible `/v1/models` endpoint. Returns healthy + base + models. */
async function probeOpenAICompatible(
  base: string,
  label: string,
): Promise<{ healthy: boolean; latency_ms?: number; base?: string; models: string[] }> {
  const url = `${base}/v1/models`;
  const start = performance.now();
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      providerDebug(`${label}.probe.not_ok`, { url, status: res.status });
      return { healthy: false, models: [] };
    }
    const body = (await res.json()) as { data?: Array<{ id?: string }> };
    const models = (body.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    return {
      healthy: true,
      latency_ms: Math.round(performance.now() - start),
      base,
      models,
    };
  } catch (err: any) {
    providerDebug(`${label}.probe.error`, {
      url,
      error: err?.message || String(err),
    });
    return { healthy: false, models: [] };
  }
}

async function probeLmStudioEndpoint(): Promise<{
  healthy: boolean;
  latency_ms?: number;
  base?: string;
  models: string[];
}> {
  const bases = lmStudioProbeBases();
  for (const base of bases) {
    const result = await probeOpenAICompatible(base, 'lmstudio');
    if (result.healthy) return result;
  }
  return { healthy: false, models: [] };
}

function providerReadyCopy(
  providerId: string,
  providerName: string,
): { message: string; description: string } {
  if (providerId === 'ollama') {
    return {
      message: 'Local AI Connected',
      description: `${providerName} is reachable and ready for chat.`,
    };
  }
  return {
    message: `${providerName} ready`,
    description: `You're set to use ${providerName}.`,
  };
}

export interface SelectProviderOptions {
  /** When true, failures use a warning instead of an error toast (bootstrap). */
  softFail?: boolean;
}

// --- ProviderManager Service ---

class ProviderManager {
  constructor() {
    // Register default LLM providers. Local providers start inactive; the
    // bootstrap probes auto-detect them and populate the model list.
    this.registerProvider({
      id: 'ollama',
      name: 'Ollama Local Router',
      type: 'local',
      status: 'inactive',
      capabilities: ['chat', 'embeddings', 'tool_use', 'reasoning'],
      models: [],
    });

    this.registerProvider({
      id: 'lmstudio',
      name: 'LM Studio Local',
      type: 'local',
      status: 'inactive',
      capabilities: ['chat', 'tool_use', 'reasoning'],
      models: [],
    });

    this.registerProvider({
      id: 'openai',
      name: 'OpenAI Cloud Gateway',
      type: 'cloud',
      status: 'inactive',
      capabilities: ['chat', 'embeddings', 'tool_use', 'reasoning', 'vision'],
      models: [],
    });

    this.registerProvider({
      id: 'anthropic',
      name: 'Anthropic Cloud Gateway',
      type: 'cloud',
      status: 'inactive',
      capabilities: ['chat', 'tool_use', 'vision', 'reasoning'],
      models: [],
    });

    this.registerProvider({
      id: 'gemini',
      name: 'Google Gemini Gateway',
      type: 'cloud',
      status: 'inactive',
      capabilities: ['chat', 'embeddings', 'tool_use', 'vision', 'reasoning'],
      models: [],
    });
  }

  public registerProvider(provider: ProviderDefinition): void {
    providerStore.registerProvider(provider);
  }

  public unregisterProvider(providerId: string): void {
    providerStore.unregisterProvider(providerId);
  }

  /**
   * Probe known local inference endpoints (Ollama, LM Studio, and any
   * user-configured OpenAI-compatible endpoints). Healthy endpoints are
   * registered/updated with their discovered model lists. Unhealthy
   * providers stay inactive with a friendly error.
   */
  public async discoverLocalProviders(): Promise<void> {
    providerDebug('discoverLocalProviders.start', {});

    // Ollama
    const ollama = await probeOllamaEndpoint();
    if (ollama.healthy && ollama.base) {
      const models = await fetchOllamaModels(ollama.base);
      providerStore.updateProvider('ollama', {
        status: 'active',
        latency: ollama.latency_ms ?? 120,
        error: undefined,
        models: models.length > 0 ? models : ['(no models installed)'],
      });
      providerDebug('discoverLocalProviders.ollama.ok', { base: ollama.base, modelCount: models.length });
    } else {
      providerStore.updateProvider('ollama', {
        status: 'inactive',
        error: 'Ollama not detected on 127.0.0.1:11434/11435.',
        models: [],
      });
    }

    // LM Studio
    const lmstudio = await probeLmStudioEndpoint();
    if (lmstudio.healthy) {
      providerStore.updateProvider('lmstudio', {
        status: 'active',
        latency: lmstudio.latency_ms ?? 120,
        error: undefined,
        models:
          lmstudio.models.length > 0 ? lmstudio.models : ['(no models loaded in LM Studio)'],
      });
      providerDebug('discoverLocalProviders.lmstudio.ok', {
        base: lmstudio.base,
        modelCount: lmstudio.models.length,
      });
    } else {
      providerStore.updateProvider('lmstudio', {
        status: 'inactive',
        error: 'LM Studio not detected on 127.0.0.1:1234.',
        models: [],
      });
    }

    // Generic OpenAI-compatible endpoints (registered dynamically)
    for (const base of openAiCompatibleBases()) {
      const id = `oai_compat_${base.replace(/[^a-z0-9]/gi, '_')}`;
      const result = await probeOpenAICompatible(base, 'oai_compat');
      if (result.healthy) {
        this.registerProvider({
          id,
          name: `OpenAI-compatible · ${base}`,
          type: 'local',
          status: 'active',
          capabilities: ['chat'],
          models: result.models.length > 0 ? result.models : ['(no models)'],
          latency: result.latency_ms,
        });
      }
    }
  }

  /**
   * Set and activate the selected Provider, syncing settings to active user profile
   */
  public async selectProvider(providerId: string, options: SelectProviderOptions = {}): Promise<void> {
    const { softFail = false } = options;
    providerDebug('selectProvider.start', { providerId, softFail });
    const provider = providerStore.getSnapshot().providers[providerId];
    if (!provider) {
      const errorMsg = `Provider "${providerId}" is not registered.`;
      throw new Error(errorMsg);
    }

    try {
      providerStore.updateProvider(providerId, { status: 'checking' });
      await this.checkProviderHealth(providerId);

      const afterCheck = providerStore.getSnapshot().providers[providerId];
      if (!afterCheck || afterCheck.status !== 'active') {
        throw new Error(afterCheck?.error || 'Provider is not healthy.');
      }

      // Save to active user settings if profile is loaded
      const activeIdentity = identityStore.getSnapshot().activeIdentity;
      if (activeIdentity) {
        const updatedProfile = {
          ...activeIdentity,
          settings: {
            ...activeIdentity.settings,
            preferredProviderId: providerId,
          },
        };
        try {
          await identityManager.saveActiveProfile(updatedProfile, { notify: false });
        } catch (saveErr: any) {
          providerDebug('selectProvider.profileSaveSkipped', {
            providerId,
            error: saveErr?.message || String(saveErr),
          });
          debugWarn(`Provider ${providerId} is healthy; profile preference save failed:`, saveErr);
        }
      }

      providerStore.setActiveProvider(providerId);

      const copy = providerReadyCopy(providerId, provider.name);
      notificationStore.addNotification({
        type: 'success',
        message: copy.message,
        description: copy.description,
      });
    } catch (err: any) {
      console.error(`Failed to activate provider ${providerId}:`, err);
      providerDebug('selectProvider.failed', {
        providerId,
        line: 'selectProvider catch',
        error: err?.message || String(err),
      });
      providerStore.updateProvider(providerId, { status: 'inactive', error: err.message });

      if (providerId === 'ollama') {
        notificationStore.addNotification({
          type: softFail ? 'info' : 'warning',
          message: 'Local AI offline',
          description:
            'Start Ollama on this machine (ollama serve) or run the PRISM backend with Ollama on port 11434/11435. You can still use workspaces and the editor.',
        });
      } else {
        notificationStore.addNotification({
          type: softFail ? 'info' : 'warning',
          message: `${provider.name} unavailable`,
          description:
            'Start the PRISM backend at http://127.0.0.1:8000 and configure API keys in Settings, then try again.',
        });
      }
      throw err;
    }
  }

  /**
   * Check health and retrieve latency metrics + model list for a specific provider.
   * Local providers (ollama, lmstudio, oai_compat_*) are probed directly; cloud
   * providers delegate to the backend `/provider/health` endpoint.
   */
  public async checkProviderHealth(providerId: string): Promise<void> {
    const provider = providerStore.getSnapshot().providers[providerId];
    if (!provider) return;

    if (providerId === 'ollama') {
      const direct = await probeOllamaEndpoint();
      if (direct.healthy && direct.base) {
        const models = await fetchOllamaModels(direct.base);
        providerStore.updateProvider(providerId, {
          status: 'active',
          latency: direct.latency_ms ?? 120,
          error: undefined,
          models: models.length > 0 ? models : ['(no models installed)'],
        });
        providerDebug('checkProviderHealth.ok', { providerId, via: 'ollama-direct', base: direct.base });
        return;
      }
    }

    if (providerId === 'lmstudio') {
      const result = await probeLmStudioEndpoint();
      if (result.healthy) {
        providerStore.updateProvider(providerId, {
          status: 'active',
          latency: result.latency_ms ?? 120,
          error: undefined,
          models:
            result.models.length > 0 ? result.models : ['(no models loaded in LM Studio)'],
        });
        return;
      }
    }

    if (providerId.startsWith('oai_compat_')) {
      const base = provider.name.replace(/^OpenAI-compatible · /, '');
      const result = await probeOpenAICompatible(base, 'oai_compat');
      if (result.healthy) {
        providerStore.updateProvider(providerId, {
          status: 'active',
          latency: result.latency_ms,
          error: undefined,
          models: result.models.length > 0 ? result.models : ['(no models)'],
        });
        return;
      }
    }

    const backendUrl = `${(import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://127.0.0.1:8000/api/v1'}/provider/health`;
    providerDebug('backend.health.request', { url: backendUrl, providerId });

    try {
      const healthData = await api.getProviderHealth();
      providerDebug('backend.health.response', { providerId, healthData });

      if (healthData && typeof healthData.healthy === 'boolean') {
        const latency = healthData.latency_ms ?? 120;

        providerStore.updateProvider(providerId, {
          status: healthData.healthy ? 'active' : 'inactive',
          latency,
          error: healthData.healthy ? undefined : healthData.message || 'Provider reported unhealthy.',
        });

        if (!healthData.healthy) {
          throw new Error(healthData.message || 'Provider reported unhealthy.');
        }
        return;
      }
      throw new Error('Invalid health payload from backend.');
    } catch (err: any) {
      providerDebug('backend.health.error', {
        providerId,
        error: err?.message || String(err),
      });
      if (providerId === 'ollama') {
        const direct = await probeOllamaEndpoint();
        if (direct.healthy && direct.base) {
          const models = await fetchOllamaModels(direct.base);
          providerStore.updateProvider(providerId, {
            status: 'active',
            latency: direct.latency_ms ?? 120,
            error: undefined,
            models: models.length > 0 ? models : ['(no models installed)'],
          });
          return;
        }
      }

      debugWarn(`Healthcheck failed for provider: ${providerId}`, err);
      const message =
        providerId === 'ollama'
          ? 'Ollama is not running and the PRISM backend is unreachable.'
          : err.message || String(err);
      providerStore.updateProvider(providerId, {
        status: 'inactive',
        latency: undefined,
        error: message,
      });
      throw new Error(message);
    }
  }

  /**
   * Check health statuses for all registered providers concurrently
   */
  public async checkAllProvidersHealth(): Promise<void> {
    providerStore.setChecking(true);
    const providers = this.getProviders();

    const tasks = providers.map(p => 
      this.checkProviderHealth(p.id).catch(() => {
        // Suppress individual failures so other checks finish
      })
    );

    await Promise.all(tasks);
    providerStore.setChecking(false);
  }

  /**
   * List all registered providers
   */
  public getProviders(): ProviderDefinition[] {
    return Array.from(Object.values(providerStore.getSnapshot().providers));
  }

  /**
   * Retrieve active provider definition
   */
  public getActiveProvider(): ProviderDefinition | null {
    const { activeProviderId, providers } = providerStore.getSnapshot();
    if (!activeProviderId) return null;
    return providers[activeProviderId] || null;
  }

  /**
   * Boostrap active provider selection based on loaded user settings.
   * Auto-discovers local providers first, then activates the preferred one
   * (or the first healthy local provider) so the user rarely needs manual
   * configuration when a local inference server is running.
   */
  public async bootstrap(): Promise<void> {
    providerDebug('bootstrap.start', {});
    await this.discoverLocalProviders();

    const activeIdentity = identityStore.getSnapshot().activeIdentity;
    const preferredId = activeIdentity?.settings?.preferredProviderId;

    const providers = providerStore.getSnapshot().providers;
    let targetId =
      preferredId && providers[preferredId]
        ? preferredId
        : null;

    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SETTINGS_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as { providers?: { preferredProviderId?: string } };
        const fromSettings = parsed.providers?.preferredProviderId;
        if (!preferredId && fromSettings && providers[fromSettings]) {
          targetId = fromSettings;
        }
      }
    } catch {
      /* keep targetId */
    }

    // If no preferred provider, prefer the first healthy local provider.
    if (!targetId) {
      const localHealthy = Object.values(providers).find(
        (p) => p.type === 'local' && p.status === 'active',
      );
      if (localHealthy) targetId = localHealthy.id;
    }
    // Fall back to ollama (inactive) so the selector has a default.
    if (!targetId) targetId = 'ollama';

    providerDebug('bootstrap.target', { targetId, preferredId });
    try {
      await this.selectProvider(targetId, { softFail: true });
    } catch {
      debugWarn(`Failed to bootstrap preferred provider ${targetId}.`);
      providerStore.setActiveProvider(null);
    }
  }
}

export const providerManager = new ProviderManager();
export default providerManager;

// --- React Selector Hook ---

export function useProviders(): ProviderState {
  return useSyncExternalStore(
    providerStore.subscribe.bind(providerStore),
    providerStore.getSnapshot.bind(providerStore)
  );
}
