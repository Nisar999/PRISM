/**
 * AuthenticationService — local session layer over IdentityManager.
 *
 * Frozen ADR #3 ("Identity before Authentication"): no cloud OAuth in v1.
 * Profiles live on disk in the per-user data directory. Passphrases are never
 * stored; only PBKDF2 salt + verifier. Sessions are AES-GCM encrypted with a
 * device-bound key so they restore automatically on the same install.
 */

import { useSyncExternalStore } from 'react';
import { Store, notificationStore } from './store';
import {
  identityManager,
  LocalIdentityProvider,
  LocalProfileRecord,
  UserProfile,
} from './identity';

// --- Provider abstraction ---

export interface AuthenticationProvider {
  readonly id: string;
  readonly displayName: string;
  readonly isCloud: boolean;
}

export interface CloudAuthenticationProvider extends AuthenticationProvider {
  readonly isCloud: true;
}

export class LocalAuthenticationProvider implements AuthenticationProvider {
  public readonly id = 'local';
  public readonly displayName = 'Local Identity';
  public readonly isCloud = false;

  get provider(): LocalIdentityProvider {
    return identityManager.getLocalProvider();
  }
}

// --- Session types ---

interface SessionPayload {
  profileId: string;
  issuedAt: number;
  expiresAt: number;
  kind: 'standard' | 'developer';
}

interface EncryptedSession {
  nonce: string;
  ciphertext: string;
  tag: string;
  issuedAt: number;
  expiresAt: number;
}

interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  user: UserProfile | null;
  error: string | null;
  isDeveloper: boolean;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSPHRASE_MIN = 4;
const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;

class AuthStore extends Store<AuthState> {
  constructor() {
    super({ status: 'loading', user: null, error: null, isDeveloper: false });
  }
  public setAuthenticated(user: UserProfile, isDeveloper: boolean): void {
    this.updateState({ status: 'authenticated', user, error: null, isDeveloper });
  }
  public setUnauthenticated(): void {
    this.updateState({ status: 'unauthenticated', user: null, error: null, isDeveloper: false });
  }
  public setError(message: string): void {
    this.updateState({ status: 'error', user: null, error: message, isDeveloper: false });
  }
  public setLoading(): void {
    this.updateState({ status: 'loading' });
  }
}

export const authStore = new AuthStore();

// --- Crypto helpers ---

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(passphrase: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
}

async function deriveVerifier(passphrase: string, salt: Uint8Array): Promise<string> {
  const bits = await pbkdf2(passphrase, salt);
  return bytesToBase64(new Uint8Array(bits));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  );
}

async function tauriInvoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

async function getDataDir(): Promise<string> {
  const dir = await tauriInvoke<string>('get_data_dir');
  return dir ?? '';
}

async function readTextFile(path: string): Promise<string | null> {
  if (isTauri()) {
    return await tauriInvoke<string>('read_file_string', { path });
  }
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(`fs:${path}`);
  }
  return null;
}

async function writeTextFile(path: string, content: string): Promise<void> {
  if (isTauri()) {
    await tauriInvoke('write_file_string', { path, content });
    return;
  }
  if (typeof window !== 'undefined') {
    if (content) window.localStorage.setItem(`fs:${path}`, content);
    else window.localStorage.removeItem(`fs:${path}`);
  }
}

// --- Device key (encrypts the restorable session blob) ---

let cachedDeviceKey: CryptoKey | null = null;

async function loadDeviceKey(): Promise<CryptoKey> {
  if (cachedDeviceKey) return cachedDeviceKey;
  const dir = await getDataDir();
  const path = dir ? `${dir}\\device.key` : 'device.key';
  let raw: Uint8Array | null = null;
  const stored = await readTextFile(path);
  if (stored && stored.trim()) {
    try {
      raw = base64ToBytes(stored.trim());
    } catch {
      raw = null;
    }
  }
  if (!raw || raw.length !== 32) {
    raw = crypto.getRandomValues(new Uint8Array(32));
    await writeTextFile(path, bytesToBase64(raw));
  }
  cachedDeviceKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  return cachedDeviceKey;
}

async function encryptSession(payload: SessionPayload): Promise<EncryptedSession> {
  const key = await loadDeviceKey();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plaintext),
  );
  const tagOffset = cipher.length - 16;
  return {
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(cipher.slice(0, tagOffset)),
    tag: bytesToBase64(cipher.slice(tagOffset)),
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}

async function decryptSession(blob: EncryptedSession): Promise<SessionPayload | null> {
  try {
    const key = await loadDeviceKey();
    const nonce = base64ToBytes(blob.nonce);
    const ct = base64ToBytes(blob.ciphertext);
    const tag = base64ToBytes(blob.tag);
    const combined = new Uint8Array(ct.length + tag.length);
    combined.set(ct, 0);
    combined.set(tag, ct.length);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, combined);
    return JSON.parse(new TextDecoder().decode(plain)) as SessionPayload;
  } catch {
    return null;
  }
}

async function resolveSessionPath(): Promise<string> {
  const dir = await getDataDir();
  return dir ? `${dir}\\session.json` : 'session.json';
}

async function readSessionBlob(): Promise<EncryptedSession | null> {
  const path = await resolveSessionPath();
  const raw = await readTextFile(path);
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as EncryptedSession;
  } catch {
    return null;
  }
}

async function writeSessionBlob(blob: EncryptedSession | null): Promise<void> {
  const path = await resolveSessionPath();
  await writeTextFile(path, blob ? JSON.stringify(blob, null, 2) : '');
}

// --- Validation ---

export interface ValidationResult {
  ok: boolean;
  error: string | null;
}

export function validateName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, error: 'Name must be at least 2 characters.' };
  if (trimmed.length > 64) return { ok: false, error: 'Name must be 64 characters or fewer.' };
  return { ok: true, error: null };
}

export function validatePassphrase(passphrase: string): ValidationResult {
  if (passphrase.length < PASSPHRASE_MIN)
    return { ok: false, error: `Passphrase must be at least ${PASSPHRASE_MIN} characters.` };
  if (passphrase.length > 256) return { ok: false, error: 'Passphrase is too long.' };
  return { ok: true, error: null };
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `prism_${Math.random().toString(36).slice(2, 10)}`;
}

// --- AuthenticationService ---

class AuthenticationService {
  private providers = new Map<string, AuthenticationProvider>();
  private activeProviderId: string | null = null;

  constructor() {
    this.registerProvider(new LocalAuthenticationProvider());
  }

  public registerProvider(provider: AuthenticationProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProviders(): AuthenticationProvider[] {
    return Array.from(this.providers.values());
  }

  public getActiveProvider(): AuthenticationProvider | null {
    if (!this.activeProviderId) return null;
    return this.providers.get(this.activeProviderId) ?? null;
  }

  public isAuthenticated(): boolean {
    return authStore.getSnapshot().status === 'authenticated';
  }

  public currentUser(): UserProfile | null {
    return authStore.getSnapshot().user;
  }

  public subscribe(listener: () => void): () => void {
    return authStore.subscribe(listener);
  }

  private async issueSession(profileId: string, kind: 'standard' | 'developer'): Promise<void> {
    const now = Date.now();
    const payload: SessionPayload = {
      profileId,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
      kind,
    };
    const blob = await encryptSession(payload);
    await writeSessionBlob(blob);
  }

  public async signup(name: string, passphrase: string): Promise<UserProfile> {
    const nameRes = validateName(name);
    if (!nameRes.ok) {
      authStore.setError(nameRes.error!);
      throw new Error(nameRes.error!);
    }
    const passRes = validatePassphrase(passphrase);
    if (!passRes.ok) {
      authStore.setError(passRes.error!);
      throw new Error(passRes.error!);
    }
    authStore.setLoading();
    try {
      const provider = identityManager.getLocalProvider();
      const existing = await provider.getProfileByName(name);
      if (existing) {
        const msg = 'A profile with that name already exists.';
        authStore.setError(msg);
        throw new Error(msg);
      }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const verifier = await deriveVerifier(passphrase, salt);
      const nowIso = new Date().toISOString();
      const record: LocalProfileRecord = {
        id: newId(),
        username: name.trim(),
        name: name.trim(),
        created_at: nowIso,
        updated_at: nowIso,
        settings: { theme: 'dark', mode: 'standard' },
        salt: bytesToBase64(salt),
        verifier,
      };
      await provider.upsertProfile(record);
      const profile = await identityManager.loadProfile(record.id);
      await this.issueSession(profile.id, 'standard');
      this.activeProviderId = 'local';
      authStore.setAuthenticated(profile, false);
      notificationStore.addNotification({
        type: 'success',
        message: 'Account created',
        description: `Welcome to PRISM, ${profile.name}.`,
      });
      return profile;
    } catch (err: any) {
      authStore.setError(err.message || String(err));
      throw err;
    }
  }

  public async login(name: string, passphrase: string): Promise<UserProfile> {
    authStore.setLoading();
    try {
      const provider = identityManager.getLocalProvider();
      const record = await provider.getProfileByName(name);
      if (!record) {
        const msg = 'No profile found with that name.';
        authStore.setError(msg);
        throw new Error(msg);
      }
      const salt = base64ToBytes(record.salt);
      const verifier = await deriveVerifier(passphrase, salt);
      if (!constantTimeEqual(verifier, record.verifier)) {
        const msg = 'Incorrect passphrase.';
        authStore.setError(msg);
        throw new Error(msg);
      }
      const profile = await identityManager.loadProfile(record.id);
      await this.issueSession(profile.id, 'standard');
      this.activeProviderId = 'local';
      authStore.setAuthenticated(profile, false);
      notificationStore.addNotification({
        type: 'info',
        message: 'Signed in',
        description: `Welcome back, ${profile.name}.`,
      });
      return profile;
    } catch (err: any) {
      authStore.setError(err.message || String(err));
      throw err;
    }
  }

  /**
   * DEV-only shortcut. Creates a real local `prism_dev` profile with a random
   * passphrase and a real encrypted session. Skips ONLY the passphrase prompt;
   * everything downstream remains real. Caller must gate on import.meta.env.DEV.
   */
  public async loginDeveloper(): Promise<UserProfile> {
    authStore.setLoading();
    try {
      const provider = identityManager.getLocalProvider();
      let record = await provider.getProfileByName('prism_dev');
      if (!record) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const passphrase = bytesToBase64(crypto.getRandomValues(new Uint8Array(24)));
        const verifier = await deriveVerifier(passphrase, salt);
        const nowIso = new Date().toISOString();
        record = {
          id: 'prism_dev',
          username: 'prism_dev',
          name: 'PRISM Developer',
          created_at: nowIso,
          updated_at: nowIso,
          settings: { theme: 'dark', mode: 'developer' },
          salt: bytesToBase64(salt),
          verifier,
        };
        await provider.upsertProfile(record);
      }
      const profile = await identityManager.loadProfile(record.id);
      await this.issueSession(profile.id, 'developer');
      this.activeProviderId = 'local';
      authStore.setAuthenticated(profile, true);
      return profile;
    } catch (err: any) {
      authStore.setError(err.message || String(err));
      throw err;
    }
  }

  public async logout(): Promise<void> {
    await writeSessionBlob(null);
    await identityManager.clearActiveIdentity();
    this.activeProviderId = null;
    authStore.setUnauthenticated();
  }

  /** Extend the current session expiry. No-op if not authenticated. */
  public async refreshSession(): Promise<void> {
    const snap = authStore.getSnapshot();
    if (snap.status !== 'authenticated' || !snap.user) return;
    await this.issueSession(snap.user.id, snap.isDeveloper ? 'developer' : 'standard');
  }

  /**
   * Restore an encrypted session from disk on cold start. Validates expiry
   * and that the referenced profile still exists. Silent on failure — the UI
   * simply shows the login screen.
   */
  public async restoreSession(): Promise<void> {
    authStore.setLoading();
    try {
      const blob = await readSessionBlob();
      if (!blob) {
        authStore.setUnauthenticated();
        return;
      }
      const payload = await decryptSession(blob);
      if (!payload) {
        await writeSessionBlob(null);
        authStore.setUnauthenticated();
        return;
      }
      if (payload.expiresAt < Date.now()) {
        await writeSessionBlob(null);
        authStore.setUnauthenticated();
        return;
      }
      const provider = identityManager.getLocalProvider();
      const record = await provider.getProfile(payload.profileId);
      if (!record) {
        await writeSessionBlob(null);
        authStore.setUnauthenticated();
        return;
      }
      const profile = await identityManager.loadProfile(record.id);
      this.activeProviderId = 'local';
      authStore.setAuthenticated(profile, payload.kind === 'developer');
    } catch (err: any) {
      authStore.setError(err.message || String(err));
    }
  }
}

export const authService = new AuthenticationService();
export default authService;

// --- React hook ---

export function useAuth(): AuthState {
  return useSyncExternalStore(
    authStore.subscribe.bind(authStore),
    authStore.getSnapshot.bind(authStore),
  );
}
