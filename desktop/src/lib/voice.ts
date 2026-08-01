/**
 * Voice subsystem — provider-abstracted speech for Milly.
 *
 * Callers use VoiceManager only. ElevenLabs is the first VoiceProvider;
 * local TTS providers can register later without changing callers.
 */

import { useSyncExternalStore } from 'react';
import { Store, notificationStore } from './store';
import { millyEngine } from './milly';
import { settingsStore } from './settings';

// --- Types ---

export interface VoiceInfo {
  id: string;
  name: string;
  previewUrl?: string;
  labels?: Record<string, string>;
}

export interface SpeakOptions {
  text: string;
  voiceId?: string;
  /** 0–1 */
  volume?: number;
  /** 0.5–2 */
  speed?: number;
  signal?: AbortSignal;
}

export interface VoiceProvider {
  readonly id: string;
  readonly displayName: string;
  readonly isCloud: boolean;
  isConfigured(): boolean;
  listVoices(): Promise<VoiceInfo[]>;
  /** Synthesize and return an audio Blob (mp3/wav). */
  synthesize(opts: SpeakOptions): Promise<Blob>;
}

export interface VoicePlaybackState {
  status: 'idle' | 'synthesizing' | 'speaking' | 'error';
  queueLength: number;
  currentText: string | null;
  error: string | null;
  voices: VoiceInfo[];
  voicesStatus: 'idle' | 'loading' | 'ready' | 'error';
}

// --- Registry ---

class VoiceRegistryImpl {
  private providers = new Map<string, VoiceProvider>();

  register(provider: VoiceProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): VoiceProvider | undefined {
    return this.providers.get(id);
  }

  list(): VoiceProvider[] {
    return Array.from(this.providers.values());
  }
}

export const voiceRegistry = new VoiceRegistryImpl();

// --- ElevenLabs provider ---

export class ElevenLabsVoiceProvider implements VoiceProvider {
  readonly id = 'elevenlabs';
  readonly displayName = 'ElevenLabs';
  readonly isCloud = true;

  private apiKey(): string {
    return settingsStore.getSnapshot().milly.voiceApiKey.trim();
  }

  isConfigured(): boolean {
    return this.apiKey().length > 0;
  }

  async listVoices(): Promise<VoiceInfo[]> {
    const key = this.apiKey();
    if (!key) throw new Error('ElevenLabs API key is not configured.');
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': key, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`ElevenLabs voices failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as {
      voices?: Array<{
        voice_id: string;
        name: string;
        preview_url?: string;
        labels?: Record<string, string>;
      }>;
    };
    return (data.voices ?? []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      previewUrl: v.preview_url,
      labels: v.labels,
    }));
  }

  async synthesize(opts: SpeakOptions): Promise<Blob> {
    const key = this.apiKey();
    if (!key) throw new Error('ElevenLabs API key is not configured.');
    const voiceId =
      opts.voiceId ||
      settingsStore.getSnapshot().milly.voiceId ||
      '21m00Tcm4TlvDq8ikWAM';

    const speed = Math.max(0.7, Math.min(1.2, opts.speed ?? 1));
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: opts.text.slice(0, 5000),
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
            speed,
          },
        }),
        signal: opts.signal,
      },
    );
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const errBody = await res.json();
        detail = errBody?.detail?.message || errBody?.detail || detail;
      } catch {
        /* ignore */
      }
      throw new Error(`ElevenLabs TTS failed: ${detail}`);
    }
    return await res.blob();
  }
}

// --- Store ---

class VoiceStore extends Store<VoicePlaybackState> {
  constructor() {
    super({
      status: 'idle',
      queueLength: 0,
      currentText: null,
      error: null,
      voices: [],
      voicesStatus: 'idle',
    });
  }

  public patch(partial: Partial<VoicePlaybackState>): void {
    this.updateState(partial);
  }
}

export const voiceStore = new VoiceStore();

// --- Manager ---

interface QueueItem {
  text: string;
  resolve: () => void;
  reject: (err: Error) => void;
}

class VoiceManager {
  private queue: QueueItem[] = [];
  private processing = false;
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private abort: AbortController | null = null;

  constructor() {
    voiceRegistry.register(new ElevenLabsVoiceProvider());
  }

  public getActiveProvider(): VoiceProvider | null {
    const id = settingsStore.getSnapshot().milly.voiceProviderId || 'elevenlabs';
    return voiceRegistry.get(id) ?? null;
  }

  public listProviders(): VoiceProvider[] {
    return voiceRegistry.list();
  }

  public async refreshVoices(): Promise<VoiceInfo[]> {
    const provider = this.getActiveProvider();
    if (!provider) {
      voiceStore.patch({ voices: [], voicesStatus: 'error', error: 'No voice provider' });
      return [];
    }
    if (!provider.isConfigured()) {
      voiceStore.patch({
        voices: [],
        voicesStatus: 'error',
        error: `${provider.displayName} is not configured`,
      });
      return [];
    }
    voiceStore.patch({ voicesStatus: 'loading', error: null });
    try {
      const voices = await provider.listVoices();
      voiceStore.patch({ voices, voicesStatus: 'ready', error: null });
      return voices;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      voiceStore.patch({ voicesStatus: 'error', error: message });
      notificationStore.addNotification({
        type: 'warning',
        message: 'Voice catalogue unavailable',
        description: message,
      });
      throw err;
    }
  }

  /** Enqueue speech. Resolves when that utterance finishes (or is cancelled). */
  public speak(text: string): Promise<void> {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return Promise.resolve();

    const milly = settingsStore.getSnapshot().milly;
    if (!milly.voiceEnabled) {
      return Promise.reject(new Error('Voice is disabled in Milly settings.'));
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ text: cleaned, resolve, reject });
      voiceStore.patch({ queueLength: this.queue.length });
      void this.pump();
    });
  }

  /** Speak immediately, clearing the queue (interrupt). */
  public async speakNow(text: string): Promise<void> {
    this.cancel();
    return this.speak(text);
  }

  public interrupt(): void {
    this.stopAudio();
    if (this.abort) {
      this.abort.abort();
      this.abort = null;
    }
    millyEngine.signalSpeaking(false);
    const snap = voiceStore.getSnapshot();
    if (snap.status === 'speaking' || snap.status === 'synthesizing') {
      voiceStore.patch({ status: 'idle', currentText: null });
    }
    this.processing = false;
    void this.pump();
  }

  public cancel(): void {
    if (this.abort) {
      this.abort.abort();
      this.abort = null;
    }
    this.stopAudio();
    const pending = this.queue.splice(0);
    for (const item of pending) {
      item.reject(new Error('Speech cancelled'));
    }
    this.processing = false;
    millyEngine.signalSpeaking(false);
    voiceStore.patch({
      status: 'idle',
      queueLength: 0,
      currentText: null,
      error: null,
    });
  }

  public async testVoice(): Promise<void> {
    await this.speakNow(
      'Hello. This is Milly speaking through the PRISM voice provider.',
    );
  }

  private stopAudio(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private async pump(): Promise<void> {
    if (this.processing) return;
    const next = this.queue.shift();
    voiceStore.patch({ queueLength: this.queue.length });
    if (!next) {
      millyEngine.signalSpeaking(false);
      voiceStore.patch({ status: 'idle', currentText: null });
      return;
    }

    this.processing = true;
    const provider = this.getActiveProvider();
    const milly = settingsStore.getSnapshot().milly;

    if (!provider || !provider.isConfigured()) {
      const err = new Error(
        provider
          ? `${provider.displayName} is not configured — add an API key in Settings → Milly.`
          : 'No voice provider selected.',
      );
      voiceStore.patch({ status: 'error', error: err.message, currentText: null });
      notificationStore.addNotification({
        type: 'warning',
        message: 'Voice unavailable',
        description: err.message,
      });
      next.reject(err);
      this.processing = false;
      void this.pump();
      return;
    }

    this.abort = new AbortController();
    voiceStore.patch({ status: 'synthesizing', currentText: next.text, error: null });
    millyEngine.signalSpeaking(true, 'Synthesizing speech…');

    try {
      const blob = await provider.synthesize({
        text: next.text,
        voiceId: milly.voiceId || undefined,
        volume: milly.volume,
        speed: milly.playbackSpeed,
        signal: this.abort.signal,
      });

      await this.playBlob(blob, milly.volume);
      next.resolve();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (this.abort?.signal.aborted || /cancel/i.test(message)) {
        next.reject(new Error('Speech cancelled'));
      } else {
        voiceStore.patch({ status: 'error', error: message });
        notificationStore.addNotification({
          type: 'error',
          message: 'Speech failed',
          description: message,
        });
        next.reject(err instanceof Error ? err : new Error(message));
      }
    } finally {
      this.abort = null;
      this.processing = false;
      millyEngine.signalSpeaking(false);
      void this.pump();
    }
  }

  private playBlob(blob: Blob, volume: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stopAudio();
      this.objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(this.objectUrl);
      audio.volume = Math.max(0, Math.min(1, volume));
      this.audio = audio;
      voiceStore.patch({ status: 'speaking' });
      millyEngine.signalSpeaking(true, 'Speaking…');

      audio.onended = () => {
        this.stopAudio();
        resolve();
      };
      audio.onerror = () => {
        this.stopAudio();
        reject(new Error('Audio playback failed'));
      };
      void audio.play().catch(reject);
    });
  }
}

export const voiceManager = new VoiceManager();
export default voiceManager;

export function useVoice(): VoicePlaybackState {
  return useSyncExternalStore(
    voiceStore.subscribe.bind(voiceStore),
    voiceStore.getSnapshot.bind(voiceStore),
  );
}
