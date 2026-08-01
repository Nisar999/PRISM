import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Palette,
  Cpu,
  Boxes,
  ScanFace,
  Sparkles,
  Search,
  Download,
  Upload,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';
import { useSettings, settingsManager, defaultSettings, type AppSettings } from '@/lib/settings';
import { useProviders, providerManager } from '@/lib/providers';
import { useIdentity, identityManager } from '@/lib/identity';
import { useMemory, memoryManager } from '@/lib/memory';
import { voiceManager, useVoice } from '@/lib/voice';
import { shellUiStore } from '@/lib/shellUi';
import { PRODUCT } from '@/lib/brand';
import { cn } from '@/lib/utils';

/** Cursor-style settings categories (Mirror lives here — not Milly menu). */
export type SettingsTab = 'general' | 'appearance' | 'models' | 'providers' | 'milly' | 'mirror';

const NAV: { id: SettingsTab; label: string; icon: typeof SettingsIcon }[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'providers', label: 'Providers', icon: Boxes },
  { id: 'milly', label: 'Milly', icon: Sparkles },
  { id: 'mirror', label: 'Mirror', icon: ScanFace },
];

function Toggle({
  on,
  onClick,
}: {
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
        on ? 'border-prism-focus bg-prism-focus/80' : 'border-border bg-muted',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all',
          on ? 'right-0.5' : 'left-0.5',
        )}
      />
    </button>
  );
}

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/[0.06] py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 max-w-xl space-y-1">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <p className="text-xs leading-relaxed text-prism-meta">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const inputClass =
  'rounded-control border border-border bg-muted px-3 py-1.5 text-xs text-foreground outline-none focus:border-prism-focus font-mono';

/**
 * Settings — Cursor-style full editor surface.
 * Categories: General · Appearance · Models · Providers · Mirror.
 * Mirror uses identityManager + memory backend (no duplicate profile system).
 */
export function SettingsPage() {
  const settings = useSettings();
  const providers = useProviders();
  const identity = useIdentity();
  const memory = useMemory();
  const voice = useVoice();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [voiceTesting, setVoiceTesting] = useState(false);

  const tabParam = params.get('tab') as SettingsTab | null;
  const [active, setActive] = useState<SettingsTab>(
    tabParam && NAV.some((n) => n.id === tabParam) ? tabParam : 'general',
  );
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  useEffect(() => {
    if (tabParam && NAV.some((n) => n.id === tabParam) && tabParam !== active) {
      setActive(tabParam);
    }
  }, [tabParam, active]);

  useEffect(() => {
    if (active !== 'mirror') return;
    const profile = identity.activeIdentity;
    if (!profile) return;
    void memoryManager.search({
      query: `${profile.name} ${profile.username} preferences skills goals`,
      limit: 12,
    });
  }, [active, identity.activeIdentity?.id, identity.activeIdentity?.name, identity.activeIdentity?.username]);

  const showSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const selectTab = (id: SettingsTab) => {
    setActive(id);
    setParams(id === 'general' ? {} : { tab: id }, { replace: true });
    setQuery('');
    setResetArmed(false);
  };

  const patch = async <C extends keyof AppSettings, K extends keyof AppSettings[C]>(
    category: C,
    key: K,
    value: AppSettings[C][K],
  ) => {
    try {
      setError(null);
      await settingsManager.updateOption(category, key, value);
      if (category === 'layout' && key === 'sidebarWidth') {
        shellUiStore.setSidebarWidth(value as number);
      }
      showSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const modelOptions = useMemo(() => {
    const preferred = settings.providers.preferredProviderId;
    const activeP = preferred
      ? providers.providers[preferred]
      : providers.activeProviderId
        ? providers.providers[providers.activeProviderId]
        : null;
    const fromActive = activeP?.models ?? [];
    const all = new Set<string>(fromActive);
    for (const p of Object.values(providers.providers)) {
      for (const m of p.models ?? []) all.add(m);
    }
    return [...all];
  }, [providers.providers, providers.activeProviderId, settings.providers.preferredProviderId]);

  const handleExport = () => {
    const raw = settingsManager.export();
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prism_config_${new Date().toISOString().split('T')[0]}.prismcfg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result;
      if (typeof text !== 'string') return;
      try {
        await settingsManager.import(text);
        showSaved();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReset = async () => {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    try {
      await settingsManager.save(defaultSettings);
      setResetArmed(false);
      showSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const q = query.trim().toLowerCase();
  const match = (...parts: string[]) =>
    !q || parts.some((p) => p.toLowerCase().includes(q));

  const profile = identity.activeIdentity;

  return (
    <div
      className="flex h-full min-h-0 w-full overflow-hidden bg-prism-editor text-foreground"
      data-name="Settings"
      role="dialog"
      aria-label={`${PRODUCT.name} Settings`}
    >
      {/* Left rail — Cursor-style category list */}
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-white/[0.06] bg-prism-panel">
        <div className="border-b border-white/[0.06] p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-prism-dim" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              className="w-full rounded-control border border-border bg-muted py-1.5 pl-8 pr-2 text-xs text-foreground outline-none placeholder:text-prism-dim focus:border-prism-focus"
            />
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Settings categories">
          {NAV.map((item) => {
            const Icon = item.icon;
            const activeNav = active === item.id && !q;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-sm transition-colors',
                  activeNav
                    ? 'bg-prism-fill text-white'
                    : 'text-prism-meta hover:bg-prism-soft hover:text-white',
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-white/[0.06] p-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-xs text-prism-meta hover:bg-prism-soft hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <label className="flex w-full cursor-pointer items-center gap-2 rounded-control px-2.5 py-1.5 text-xs text-prism-meta hover:bg-prism-soft hover:text-white">
            <Upload className="h-3.5 w-3.5" /> Import
            <input type="file" accept=".json,.prismcfg" className="hidden" onChange={handleImport} />
          </label>
          <button
            type="button"
            onClick={() => void handleReset()}
            className={cn(
              'flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-xs hover:bg-prism-soft',
              resetArmed ? 'text-destructive' : 'text-prism-meta hover:text-white',
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {resetArmed ? 'Click again to confirm reset' : 'Reset defaults'}
          </button>
        </div>
      </aside>

      {/* Main editor */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Inline toolbar — not a second title bar. The global TitleBar above
            already provides the single header region for the whole app. */}
        <div className="flex shrink-0 items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-2">
            <h1 className="font-manrope text-sm font-semibold text-white">
              {NAV.find((n) => n.id === active)?.label ?? 'Settings'}
            </h1>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                <CheckCircle className="h-3 w-3" /> Saved
              </span>
            ) : null}
          </div>
          <button
            type="button"
            title="Close settings"
            className="rounded-control p-1.5 text-prism-meta hover:bg-prism-soft hover:text-white prism-focus-ring"
            onClick={() => navigate(-1)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2 md:px-10">
          <div className="mx-auto max-w-3xl">
            {/* —— General —— */}
            {(active === 'general' || q) && (
              <section className={cn(q && active !== 'general' ? 'mt-2' : '')}>
                {q ? <h2 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-prism-dim">General</h2> : null}
                {match('autosave', 'workspace') && (
                  <Row
                    title="Autosave interval"
                    description="Seconds between automatic project.json updates."
                  >
                    <input
                      type="number"
                      className={cn(inputClass, 'w-28')}
                      value={settings.general.autosaveInterval}
                      onChange={(e) =>
                        void patch('general', 'autosaveInterval', parseInt(e.target.value, 10))
                      }
                    />
                  </Row>
                )}
                {match('notification', 'toast') && (
                  <Row
                    title="Enable notifications"
                    description="Show toasts for kernel and agent events."
                  >
                    <Toggle
                      on={settings.general.enableNotifications}
                      onClick={() =>
                        void patch(
                          'general',
                          'enableNotifications',
                          !settings.general.enableNotifications,
                        )
                      }
                    />
                  </Row>
                )}
                {match('debug', 'logging', 'kernel') && (
                  <Row
                    title="Debug logging"
                    description="Verbose client console logs for kernel traffic."
                  >
                    <Toggle
                      on={settings.general.debugLogging}
                      onClick={() =>
                        void patch('general', 'debugLogging', !settings.general.debugLogging)
                      }
                    />
                  </Row>
                )}
              </section>
            )}

            {/* —— Appearance (layout store) —— */}
            {(active === 'appearance' || q) && (
              <section>
                {q ? (
                  <h2 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-prism-dim">
                    Appearance
                  </h2>
                ) : null}
                {match('layout', 'panel', 'appearance') && (
                  <Row
                    title="Default panel layout"
                    description="Preset chrome orientation when a workspace opens."
                  >
                    <select
                      className={cn(inputClass, 'w-48')}
                      value={settings.layout.defaultPanelLayout}
                      onChange={(e) =>
                        void patch(
                          'layout',
                          'defaultPanelLayout',
                          e.target.value as AppSettings['layout']['defaultPanelLayout'],
                        )
                      }
                    >
                      <option value="developer">Developer</option>
                      <option value="analytics">Analytics</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </Row>
                )}
                {match('sidebar', 'width', 'appearance') && (
                  <Row
                    title="Sidebar width"
                    description="Navigation sidebar width in pixels (180–480)."
                  >
                    <input
                      type="number"
                      className={cn(inputClass, 'w-28')}
                      value={settings.layout.sidebarWidth}
                      onChange={(e) =>
                        void patch('layout', 'sidebarWidth', parseInt(e.target.value, 10))
                      }
                    />
                  </Row>
                )}
                {match('restore', 'layout', 'appearance') && (
                  <Row
                    title="Restore last layout"
                    description="Reload saved panel ratios on startup."
                  >
                    <Toggle
                      on={settings.layout.restoreLastLayout}
                      onClick={() =>
                        void patch(
                          'layout',
                          'restoreLastLayout',
                          !settings.layout.restoreLastLayout,
                        )
                      }
                    />
                  </Row>
                )}
              </section>
            )}

            {/* —— Models —— */}
            {(active === 'models' || q) && (
              <section>
                {q ? (
                  <h2 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-prism-dim">
                    Models
                  </h2>
                ) : null}
                {match('model', 'llm') && (
                  <Row
                    title="Preferred model"
                    description="Model used when the active provider exposes a catalogue (from Provider Manager)."
                  >
                    <select
                      className={cn(inputClass, 'w-56')}
                      value={settings.providers.preferredModel}
                      onChange={(e) => void patch('providers', 'preferredModel', e.target.value)}
                    >
                      <option value="">Provider default</option>
                      {modelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </Row>
                )}
                {match('model', 'refresh', 'health') && (
                  <Row
                    title="Refresh model list"
                    description="Re-probe providers so Models stays in sync with the backend catalogue."
                  >
                    <button
                      type="button"
                      className="rounded-control border border-border px-3 py-1.5 text-xs text-white hover:bg-prism-soft"
                      onClick={() => {
                        void providerManager.bootstrap().then(showSaved).catch((err: unknown) => {
                          setError(err instanceof Error ? err.message : String(err));
                        });
                      }}
                    >
                      Refresh providers
                    </button>
                  </Row>
                )}
                {!q && modelOptions.length > 0 ? (
                  <div className="mt-2 rounded-control border border-white/[0.06] bg-prism-panel/60 p-3">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-prism-dim">
                      Available models
                    </p>
                    <ul className="space-y-1 font-mono text-[11px] text-prism-meta">
                      {modelOptions.map((m) => (
                        <li key={m} className="text-white/80">
                          {m}
                          {settings.providers.preferredModel === m ? (
                            <span className="ml-2 text-prism-cyan">preferred</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {!q && modelOptions.length === 0 ? (
                  <p className="py-4 text-xs text-prism-dim">
                    No models reported yet. Configure a provider, then refresh.
                  </p>
                ) : null}
              </section>
            )}

            {/* —— Providers —— */}
            {(active === 'providers' || q) && (
              <section>
                {q ? (
                  <h2 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-prism-dim">
                    Providers
                  </h2>
                ) : null}
                {match('provider', 'active', 'llm') && (
                  <Row
                    title="Active provider"
                    description="Primary gateway for agent and conversation pipelines."
                  >
                    <select
                      className={cn(inputClass, 'w-56')}
                      value={settings.providers.preferredProviderId}
                      onChange={(e) => {
                        void patch('providers', 'preferredProviderId', e.target.value);
                        void providerManager.selectProvider(e.target.value, { softFail: true });
                      }}
                    >
                      {Object.values(providers.providers).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.status})
                        </option>
                      ))}
                    </select>
                  </Row>
                )}
                {match('ollama', 'endpoint') && (
                  <Row title="Ollama endpoint" description="Base URL for local Ollama.">
                    <input
                      type="text"
                      className={cn(inputClass, 'w-64')}
                      value={settings.providers.ollamaEndpoint}
                      onChange={(e) => void patch('providers', 'ollamaEndpoint', e.target.value)}
                    />
                  </Row>
                )}
                {match('openai', 'api', 'key') && (
                  <Row title="OpenAI API key" description="Token for OpenAI models.">
                    <input
                      type="password"
                      placeholder="sk-…"
                      className={cn(inputClass, 'w-64')}
                      value={settings.providers.openaiKey}
                      onChange={(e) => void patch('providers', 'openaiKey', e.target.value)}
                    />
                  </Row>
                )}
                {match('anthropic', 'api', 'key') && (
                  <Row title="Anthropic API key" description="Token for Anthropic models.">
                    <input
                      type="password"
                      placeholder="sk-ant-…"
                      className={cn(inputClass, 'w-64')}
                      value={settings.providers.anthropicKey}
                      onChange={(e) => void patch('providers', 'anthropicKey', e.target.value)}
                    />
                  </Row>
                )}
                {match('gemini', 'google', 'api', 'key') && (
                  <Row title="Gemini API key" description="Token for Google Gemini.">
                    <input
                      type="password"
                      placeholder="AIza…"
                      className={cn(inputClass, 'w-64')}
                      value={settings.providers.geminiKey}
                      onChange={(e) => void patch('providers', 'geminiKey', e.target.value)}
                    />
                  </Row>
                )}
                {!q ? (
                  <ul className="mt-3 space-y-2">
                    {Object.values(providers.providers).map((p) => (
                      <li
                        key={p.id}
                        className={cn(
                          'flex items-center justify-between rounded-control border border-white/[0.06] bg-prism-soft px-3 py-2 text-xs',
                          providers.activeProviderId === p.id && 'border-prism-focus/40',
                        )}
                      >
                        <span className="font-medium text-white">{p.name}</span>
                        <span className="font-mono text-prism-meta">
                          {p.type} · {p.status}
                          {p.models?.length ? ` · ${p.models.length} models` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            )}

            {/* —— Milly (presence + voice) —— */}
            {(active === 'milly' || q) && (
              <section>
                {q ? (
                  <h2 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-prism-dim">
                    Milly
                  </h2>
                ) : (
                  <p className="mb-4 text-xs text-prism-meta">
                    Cognitive presence, animations, and optional speech. Voice speaks response
                    content only — never fabricated character dialogue. Defaults keep voice off.
                  </p>
                )}

                {match('animation', 'motion', 'thinking') && (
                  <Row
                    title="Animations"
                    description="State-driven motion on the Milly presence glyph."
                  >
                    <Toggle
                      on={settings.milly.animationsEnabled}
                      onClick={() =>
                        void patch('milly', 'animationsEnabled', !settings.milly.animationsEnabled)
                      }
                    />
                  </Row>
                )}
                {match('thinking', 'mascot') && (
                  <Row
                    title="Thinking animation"
                    description="Show brand mascot during thinking, writing, speaking, and success."
                  >
                    <Toggle
                      on={settings.milly.thinkingAnimation}
                      onClick={() =>
                        void patch('milly', 'thinkingAnimation', !settings.milly.thinkingAnimation)
                      }
                    />
                  </Row>
                )}
                {match('voice', 'speech', 'speak') && (
                  <Row
                    title="Voice enabled"
                    description="Allow TTS via the selected VoiceProvider (ElevenLabs first)."
                  >
                    <Toggle
                      on={settings.milly.voiceEnabled}
                      onClick={() =>
                        void patch('milly', 'voiceEnabled', !settings.milly.voiceEnabled)
                      }
                    />
                  </Row>
                )}
                {match('auto', 'speak') && (
                  <Row
                    title="Auto-speak responses"
                    description="Speak completed conversation answers when voice is enabled."
                  >
                    <Toggle
                      on={settings.milly.autoSpeak}
                      onClick={() => void patch('milly', 'autoSpeak', !settings.milly.autoSpeak)}
                    />
                  </Row>
                )}
                {match('provider', 'elevenlabs', 'voice') && (
                  <Row title="Voice provider" description="Abstracted registry — callers never hardcode a vendor.">
                    <select
                      className={cn(inputClass, 'w-56')}
                      value={settings.milly.voiceProviderId}
                      onChange={(e) => void patch('milly', 'voiceProviderId', e.target.value)}
                    >
                      {voiceManager.listProviders().map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.displayName}
                          {p.isCloud ? ' (cloud)' : ' (local)'}
                        </option>
                      ))}
                    </select>
                  </Row>
                )}
                {match('elevenlabs', 'api', 'key') && (
                  <Row title="ElevenLabs API key" description="Stored in local settings — never logged.">
                    <input
                      type="password"
                      placeholder="xi-…"
                      className={cn(inputClass, 'w-64')}
                      value={settings.milly.voiceApiKey}
                      onChange={(e) => void patch('milly', 'voiceApiKey', e.target.value)}
                    />
                  </Row>
                )}
                {match('voice', 'id', 'catalogue') && (
                  <Row title="Voice" description="Select from the provider catalogue after refresh.">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className={cn(inputClass, 'w-48')}
                        value={settings.milly.voiceId}
                        onChange={(e) => void patch('milly', 'voiceId', e.target.value)}
                      >
                        <option value="">Default</option>
                        {voice.voices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="rounded-control border border-border px-2 py-1.5 text-xs text-white hover:bg-white/5"
                        onClick={() => void voiceManager.refreshVoices().catch(() => undefined)}
                      >
                        Refresh
                      </button>
                      <button
                        type="button"
                        disabled={voiceTesting || !settings.milly.voiceEnabled}
                        className="rounded-control border border-prism-focus/40 bg-prism-focus/15 px-2 py-1.5 text-xs text-white disabled:opacity-40"
                        onClick={() => {
                          setVoiceTesting(true);
                          void voiceManager
                            .testVoice()
                            .catch(() => undefined)
                            .finally(() => setVoiceTesting(false));
                        }}
                      >
                        {voiceTesting || voice.status === 'speaking' || voice.status === 'synthesizing'
                          ? 'Speaking…'
                          : 'Test voice'}
                      </button>
                      {(voice.status === 'speaking' || voice.status === 'synthesizing') && (
                        <button
                          type="button"
                          className="rounded-control border border-rose-400/35 px-2 py-1.5 text-xs text-rose-100"
                          onClick={() => voiceManager.cancel()}
                        >
                          Stop
                        </button>
                      )}
                    </div>
                  </Row>
                )}
                {match('volume') && (
                  <Row title="Volume" description={`${Math.round(settings.milly.volume * 100)}%`}>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-40"
                      value={settings.milly.volume}
                      onChange={(e) => void patch('milly', 'volume', Number(e.target.value))}
                    />
                  </Row>
                )}
                {match('speed', 'playback') && (
                  <Row
                    title="Playback speed"
                    description={`${settings.milly.playbackSpeed.toFixed(2)}× (provider-limited)`}
                  >
                    <input
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.05}
                      className="w-40"
                      value={settings.milly.playbackSpeed}
                      onChange={(e) => void patch('milly', 'playbackSpeed', Number(e.target.value))}
                    />
                  </Row>
                )}
                {match('debug', 'performance') && (
                  <Row
                    title="Milly debug"
                    description="Expose state labels for diagnosing presence transitions."
                  >
                    <Toggle
                      on={settings.milly.debug}
                      onClick={() => void patch('milly', 'debug', !settings.milly.debug)}
                    />
                  </Row>
                )}
                {!q && settings.milly.debug ? (
                  <p className="mt-2 font-mono text-[11px] text-prism-dim">
                    voice status: {voice.status} · queue {voice.queueLength}
                    {voice.error ? ` · ${voice.error}` : ''}
                  </p>
                ) : null}
              </section>
            )}

            {/* —— Mirror (identity + memory; ADR-008) —— */}
            {(active === 'mirror' || q) && (
              <section>
                {q ? (
                  <h2 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-prism-dim">
                    Mirror
                  </h2>
                ) : (
                  <p className="mb-4 text-xs text-prism-meta">
                    What PRISM knows about you from confirmed identity and Memory engine hits.
                    Mirror never guesses — edit profile fields below via the existing identity
                    provider.
                  </p>
                )}

                {!profile ? (
                  <p className="py-6 text-xs text-prism-dim">
                    No identity profile loaded. Local identity bootstraps on launch.
                  </p>
                ) : (
                  <>
                    {match('name', 'mirror', 'identity', 'profile') && (
                      <Row title="Name" description="Confirmed display name (identity provider).">
                        <input
                          type="text"
                          className={cn(inputClass, 'w-56')}
                          value={profile.name}
                          onChange={(e) =>
                            void identityManager.saveActiveProfile({
                              ...profile,
                              name: e.target.value,
                            })
                          }
                        />
                      </Row>
                    )}
                    {match('username', 'handle', 'mirror') && (
                      <Row title="Username" description="Confirmed handle.">
                        <input
                          type="text"
                          className={cn(inputClass, 'w-56')}
                          value={profile.username}
                          onChange={(e) =>
                            void identityManager.saveActiveProfile({
                              ...profile,
                              username: e.target.value,
                            })
                          }
                        />
                      </Row>
                    )}
                    {match('email', 'mirror') && (
                      <Row title="Email" description="Optional confirmed contact.">
                        <input
                          type="email"
                          className={cn(inputClass, 'w-56')}
                          value={profile.email ?? ''}
                          placeholder="Not set"
                          onChange={(e) =>
                            void identityManager.saveActiveProfile({
                              ...profile,
                              email: e.target.value || undefined,
                            })
                          }
                        />
                      </Row>
                    )}

                    {!q ? (
                      <div className="mt-4 space-y-3 rounded-control border border-white/[0.06] bg-prism-panel/50 p-4 font-mono text-[11px] text-prism-meta">
                        <p className="font-sans text-xs font-semibold text-white">Registry</p>
                        <p>UUID: {profile.id}</p>
                        <p>Provider: {identity.activeProviderId}</p>
                        <p>Created: {new Date(profile.created_at).toLocaleString()}</p>
                        <p>Updated: {new Date(profile.updated_at).toLocaleString()}</p>
                        {Object.keys(profile.settings ?? {}).length > 0 ? (
                          <div className="border-t border-white/[0.06] pt-3">
                            <p className="mb-1 font-sans text-[10px] font-bold uppercase tracking-wide text-prism-dim">
                              Confirmed preference keys
                            </p>
                            <ul className="space-y-1">
                              {Object.entries(profile.settings).map(([k, v]) => (
                                <li key={k}>
                                  {k}: {typeof v === 'string' ? v : JSON.stringify(v)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="italic">No confirmed preference keys yet.</p>
                        )}
                      </div>
                    ) : null}

                    {!q ? (
                      <div className="mt-4">
                        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-prism-dim">
                          Memory engine · related hits
                        </p>
                        {memory.status === 'loading' ? (
                          <p className="text-xs text-prism-dim">Searching memory…</p>
                        ) : memory.lastResults.length === 0 ? (
                          <p className="text-xs text-prism-dim">
                            No related memories. Conversation and memory writes will appear here.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {memory.lastResults.slice(0, 8).map((hit) => (
                              <li
                                key={hit.memory.id}
                                className="rounded-control border border-white/[0.06] bg-prism-soft p-2.5 text-xs"
                              >
                                <div className="mb-1 flex justify-between font-mono text-[10px] text-prism-meta">
                                  <span>{hit.memory.memory_type}</span>
                                  <span>
                                    trust {hit.memory.trust.toFixed(2)} · rel{' '}
                                    {hit.relevance_score.toFixed(2)}
                                  </span>
                                </div>
                                <p className="line-clamp-3 text-white/85">{hit.memory.content}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            )}

            {q &&
            !match(
              'autosave',
              'notification',
              'debug',
              'layout',
              'sidebar',
              'restore',
              'model',
              'provider',
              'ollama',
              'openai',
              'anthropic',
              'gemini',
              'name',
              'username',
              'email',
              'mirror',
              'identity',
              'appearance',
              'llm',
              'api',
              'key',
            ) ? (
              <p className="py-10 text-center text-xs text-prism-dim">No matching settings.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
