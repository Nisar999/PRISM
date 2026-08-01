import { useSyncExternalStore } from 'react';
import { Store, notificationStore } from './store';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  email?: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
  settings: Record<string, any>;
}

/**
 * On-disk record for a local profile. The `salt` + `verifier` form a PBKDF2
 * challenge-response pair; the plaintext passphrase is never persisted.
 */
export interface LocalProfileRecord {
  id: string;
  username: string;
  name: string;
  email?: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
  settings: Record<string, any>;
  /** Base64 PBKDF2 salt used to derive the verifier. */
  salt: string;
  /** Base64 PBKDF2 hash of the passphrase (the verifier). */
  verifier: string;
}

export interface IdentityProvider {
  id: string;
  name: string;
  initialize(): Promise<void>;
  getUserProfile(): Promise<UserProfile | null>;
  saveUserProfile(profile: UserProfile): Promise<void>;
}

// --- Platform-Agnostic Tauri FS Wrapper ---

async function checkIsTauri(): Promise<boolean> {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

async function tauriInvoke<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  const isTauri = await checkIsTauri();
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  }
  
  // Browser fallback using LocalStorage
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

// --- Local Identity Provider Implementation ---

/**
 * Multi-profile local identity storage. Backed by Tauri FS in the per-user
 * data directory. Passphrases are never stored; only PBKDF2 salt+verifier.
 *
 * Files:
 *   <data_dir>/profiles.json   — list of LocalProfileRecord
 *   <data_dir>/identity.json   — cache of the active UserProfile (legacy compat)
 */
export class LocalIdentityProvider implements IdentityProvider {
  public id = 'local';
  public name = 'Local Identity Provider';
  private identityFilePath = 'identity.json';
  private profilesFilePath = 'profiles.json';

  private async resolveDataDir(): Promise<string> {
    try {
      const isTauri = await checkIsTauri();
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<string>('get_data_dir');
      }
    } catch {
      /* fall through */
    }
    return '';
  }

  private async resolveIdentityPath(): Promise<string> {
    const dir = await this.resolveDataDir();
    return dir ? `${dir}\\identity.json` : this.identityFilePath;
  }

  private async resolveProfilesPath(): Promise<string> {
    const dir = await this.resolveDataDir();
    return dir ? `${dir}\\profiles.json` : this.profilesFilePath;
  }

  public async initialize(): Promise<void> {
    // No auto-create. The provider is ready whether or not profiles exist;
    // signup/login are explicit acts owned by AuthenticationService.
  }

  /** Read all stored profile records (metadata + verifier, never passphrases). */
  public async listProfiles(): Promise<LocalProfileRecord[]> {
    try {
      const path = await this.resolveProfilesPath();
      const content = await tauriInvoke<string>('read_file_string', { path });
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? (parsed as LocalProfileRecord[]) : [];
    } catch {
      return [];
    }
  }

  /** Persist the full profile list atomically. */
  public async saveProfiles(profiles: LocalProfileRecord[]): Promise<void> {
    const path = await this.resolveProfilesPath();
    await tauriInvoke('write_file_string', {
      path,
      content: JSON.stringify(profiles, null, 2),
    });
  }

  public async getProfile(id: string): Promise<LocalProfileRecord | null> {
    const profiles = await this.listProfiles();
    return profiles.find((p) => p.id === id) ?? null;
  }

  public async getProfileByName(name: string): Promise<LocalProfileRecord | null> {
    const profiles = await this.listProfiles();
    const lower = name.trim().toLowerCase();
    return (
      profiles.find(
        (p) => p.username.toLowerCase() === lower || p.name.toLowerCase() === lower,
      ) ?? null
    );
  }

  /** Upsert a profile record (used by AuthenticationService after signup). */
  public async upsertProfile(record: LocalProfileRecord): Promise<void> {
    const profiles = await this.listProfiles();
    const idx = profiles.findIndex((p) => p.id === record.id);
    if (idx >= 0) {
      profiles[idx] = record;
    } else {
      profiles.push(record);
    }
    await this.saveProfiles(profiles);
  }

  public async deleteProfile(id: string): Promise<void> {
    const profiles = await this.listProfiles();
    await this.saveProfiles(profiles.filter((p) => p.id !== id));
  }

  /** Strip the verifier/salt for use as a UserProfile in UI state. */
  public toUserProfile(record: LocalProfileRecord): UserProfile {
    return {
      id: record.id,
      username: record.username,
      name: record.name,
      email: record.email,
      avatar: record.avatar,
      created_at: record.created_at,
      updated_at: record.updated_at,
      settings: record.settings,
    };
  }

  public async getUserProfile(): Promise<UserProfile | null> {
    try {
      const path = await this.resolveIdentityPath();
      const content = await tauriInvoke<string>('read_file_string', { path });
      if (!content || !content.trim()) return null;
      return JSON.parse(content) as UserProfile;
    } catch {
      return null;
    }
  }

  public async saveUserProfile(profile: UserProfile): Promise<void> {
    profile.updated_at = new Date().toISOString();
    try {
      const path = await this.resolveIdentityPath();
      await tauriInvoke('write_file_string', {
        path,
        content: JSON.stringify(profile, null, 2),
      });
    } catch (err: any) {
      console.error('Failed to save User Profile to disk:', err);
      throw err;
    }
  }

  /** Persist the active profile cache (identity.json) from a record. */
  public async setActiveProfile(record: LocalProfileRecord): Promise<void> {
    await this.saveUserProfile(this.toUserProfile(record));
  }

  /** Clear the active profile cache (used on logout). */
  public async clearActiveProfile(): Promise<void> {
    try {
      const path = await this.resolveIdentityPath();
      await tauriInvoke('write_file_string', { path, content: '' });
    } catch {
      /* ignore */
    }
  }
}

// --- Identity Store (UI-Agnostic) ---

export interface IdentityState {
  activeIdentity: UserProfile | null;
  activeProviderId: string | null;
  isInitialized: boolean;
  error: string | null;
}

class IdentityStore extends Store<IdentityState> {
  constructor() {
    super({
      activeIdentity: null,
      activeProviderId: null,
      isInitialized: false,
      error: null,
    });
  }

  public setIdentity(profile: UserProfile | null, providerId: string | null): void {
    this.updateState({
      activeIdentity: profile,
      activeProviderId: providerId,
      error: null,
    });
  }

  public setInitialized(isInitialized: boolean): void {
    this.updateState({ isInitialized });
  }

  public setError(error: string | null): void {
    this.updateState({ error });
  }
}

export const identityStore = new IdentityStore();

// --- IdentityManager Service ---

class IdentityManager {
  private providers: Map<string, IdentityProvider> = new Map();

  constructor() {
    // Automatically register the default local identity provider
    this.registerProvider(new LocalIdentityProvider());
  }

  /**
   * Register a new identity provider.
   */
  public registerProvider(provider: IdentityProvider): void {
    if (this.providers.has(provider.id)) {
      console.warn(`Overwriting identity provider registration for ID: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
  }

  /**
   * List all registered identity providers.
   */
  public getProviders(): IdentityProvider[] {
    return Array.from(this.providers.values());
  }

  /** Typed accessor for the local provider (the only registered provider in v1). */
  public getLocalProvider(): LocalIdentityProvider {
    const provider = this.providers.get('local');
    if (!provider) {
      throw new Error('Local identity provider is not registered.');
    }
    return provider as LocalIdentityProvider;
  }

  /**
   * Activate a specific profile by id. The profile record must already exist
   * on disk. AuthenticationService owns profile creation/passphrase checks.
   */
  public async loadProfile(profileId: string): Promise<UserProfile> {
    const provider = this.getLocalProvider();
    const record = await provider.getProfile(profileId);
    if (!record) {
      throw new Error(`Profile "${profileId}" not found.`);
    }
    await provider.setActiveProfile(record);
    const profile = provider.toUserProfile(record);
    identityStore.setIdentity(profile, provider.id);
    identityStore.setInitialized(true);
    return profile;
  }

  /**
   * Save changes to the active user profile.
   */
  public async saveActiveProfile(
    updatedProfile: UserProfile,
    options: { notify?: boolean } = {},
  ): Promise<void> {
    const { notify = true } = options;
    const { activeProviderId, activeIdentity } = identityStore.getSnapshot();
    if (!activeProviderId || !activeIdentity) {
      throw new Error('No active identity to update.');
    }

    const provider = this.providers.get(activeProviderId);
    if (!provider) {
      throw new Error('Active identity provider not found.');
    }

    try {
      await provider.saveUserProfile(updatedProfile);
      identityStore.setIdentity(updatedProfile, activeProviderId);

      // Mirror profile-record fields so the next login still sees the new name/email.
      if (provider instanceof LocalIdentityProvider) {
        const record = await provider.getProfile(updatedProfile.id);
        if (record) {
          record.name = updatedProfile.name;
          record.email = updatedProfile.email;
          record.username = updatedProfile.username;
          record.avatar = updatedProfile.avatar;
          record.settings = updatedProfile.settings;
          record.updated_at = new Date().toISOString();
          await provider.upsertProfile(record);
        }
      }

      if (notify) {
        notificationStore.addNotification({
          type: 'success',
          message: 'Profile saved',
          description: 'Your settings were updated.',
        });
      }
    } catch (err: any) {
      console.error('Failed to update user profile:', err);
      notificationStore.addNotification({
        type: 'error',
        message: 'Profile Save Failed',
        description: err.message || String(err),
      });
      throw err;
    }
  }

  /** Clear the active identity (called by AuthenticationService.logout). */
  public async clearActiveIdentity(): Promise<void> {
    const provider = this.getLocalProvider();
    await provider.clearActiveProfile();
    identityStore.setIdentity(null, null);
    identityStore.setInitialized(false);
  }
}

export const identityManager = new IdentityManager();
export default identityManager;

// --- React Selector Hook ---

export function useIdentity(): IdentityState {
  return useSyncExternalStore(
    identityStore.subscribe.bind(identityStore),
    identityStore.getSnapshot.bind(identityStore)
  );
}
