/**
 * Ensure packaged runtime services (backend + editing-engine sidecar) are up.
 * Silent — never surfaces localhost / engine vendor names to callers.
 */

import { isNativeDesktop } from '@/lib/nativeFolder';

export interface EditorRuntimeEnsureResult {
  ok: boolean;
  editor: string;
  backend: string;
}

export interface MountEditorWorkspaceResult {
  ok: boolean;
  folderUri: string;
  path: string;
  remounted?: boolean;
}

/** Invoke Tauri ensure_runtime_services when running as native desktop. */
export async function ensureEditorRuntime(): Promise<EditorRuntimeEnsureResult> {
  if (!(await isNativeDesktop())) {
    return { ok: true, editor: 'browser_dev', backend: 'browser_dev' };
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<Record<string, string>>('ensure_runtime_services');
    const editor = result.codeOss ?? result.code_oss ?? result.editor ?? 'unknown';
    const backend = result.backend ?? 'unknown';
    return { ok: true, editor, backend };
  } catch {
    return { ok: false, editor: 'ensure_failed', backend: 'ensure_failed' };
  }
}

/**
 * Mount a local disk folder into the editing engine FS provider and return the
 * workbench folder URI (`vscode-test-web://mount/`). No-ops in browser/dev.
 */
export async function mountEditorWorkspace(
  path: string,
): Promise<MountEditorWorkspaceResult | null> {
  if (!(await isNativeDesktop())) {
    return null;
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<MountEditorWorkspaceResult>('mount_editor_workspace', { path });
}

/** Canonical mounted-folder URI used by the packaged editing engine. */
export const MOUNTED_WORKSPACE_URI = 'vscode-test-web://mount/';
