/**
 * PRISM ↔ Code-OSS editor bridge protocol.
 * The adapter is the only surface PRISM may use to talk to the editing engine.
 * Keep messages versioned and free of VS Code internal types.
 */

export const EDITOR_PROTOCOL_VERSION = 1 as const;

export const EDITOR_MSG = {
  // Parent → host
  PING: 'prism.editor.ping',
  OPEN_WORKSPACE: 'prism.editor.openWorkspace',
  OPEN_FILE: 'prism.editor.openFile',
  FOCUS: 'prism.editor.focus',
  DISPOSE: 'prism.editor.dispose',
  // Host → parent
  READY: 'prism.editor.ready',
  PONG: 'prism.editor.pong',
  ACTIVE_EDITOR: 'prism.editor.activeEditor',
  WORKSPACE_OPENED: 'prism.editor.workspaceOpened',
  ERROR: 'prism.editor.error',
} as const;

export type EditorMsgType = (typeof EDITOR_MSG)[keyof typeof EDITOR_MSG];

export type EditorEngineKind = 'code-oss-bridge' | 'code-oss-web';

export type EditorLifecycle =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'disposed';

export interface ActiveEditorInfo {
  uri: string;
  language?: string;
  dirty?: boolean;
  title?: string;
}

export interface OpenWorkspaceRequest {
  folderUri: string;
  name?: string;
}

export interface OpenFileRequest {
  uri: string;
  content?: string;
  language?: string;
  title?: string;
}

export interface EditorEnvelope<T = unknown> {
  v: typeof EDITOR_PROTOCOL_VERSION;
  type: EditorMsgType;
  requestId?: string;
  payload?: T;
}

export function isEditorEnvelope(data: unknown): data is EditorEnvelope {
  if (!data || typeof data !== 'object') return false;
  const e = data as EditorEnvelope;
  return e.v === EDITOR_PROTOCOL_VERSION && typeof e.type === 'string';
}

export function makeEnvelope<T>(
  type: EditorMsgType,
  payload?: T,
  requestId?: string,
): EditorEnvelope<T> {
  return { v: EDITOR_PROTOCOL_VERSION, type, payload, requestId };
}
