/**
 * Debug logging gated by Settings → General → Debug logging (and Vite DEV).
 * Reads settings from localStorage to avoid circular imports with settings/providers.
 */

function enabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    if (typeof window === 'undefined') return false;
    const raw = window.localStorage.getItem('prism_app_settings');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { general?: { debugLogging?: boolean } };
    return parsed.general?.debugLogging === true;
  } catch {
    return false;
  }
}

export function debugLog(...args: unknown[]): void {
  if (!enabled()) return;
  console.debug('[PRISM]', ...args);
}

export function debugWarn(...args: unknown[]): void {
  if (!enabled()) return;
  console.warn('[PRISM]', ...args);
}
