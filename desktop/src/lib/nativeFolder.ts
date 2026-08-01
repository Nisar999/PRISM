/**
 * Native folder picking — presentation/OS bridge only.
 * Uses Tauri dialog when available; falls back to window.prompt in browser.
 * Does not introduce a new manager.
 */

async function isTauri(): Promise<boolean> {
  return typeof window !== 'undefined' && !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

/**
 * Open a native folder picker (Tauri) or prompt (browser).
 * Returns absolute/relative path string, or null if cancelled.
 */
export async function pickWorkspaceFolder(defaultPath?: string): Promise<string | null> {
  if (await isTauri()) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Open Folder',
        defaultPath: defaultPath || undefined,
      });
      if (typeof selected === 'string' && selected.trim()) return selected.trim();
      return null;
    } catch (err) {
      console.warn('Native folder dialog failed; falling back to prompt', err);
    }
  }

  if (typeof window === 'undefined') return null;
  const typed = window.prompt(
    'Workspace path (relative or absolute):',
    defaultPath ?? '',
  );
  return typed?.trim() ? typed.trim() : null;
}

/** True when running inside the Tauri WebView. */
export async function isNativeDesktop(): Promise<boolean> {
  return isTauri();
}
