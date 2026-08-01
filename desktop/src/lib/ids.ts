/**
 * ID helpers — keep local workflow/execution IDs separate from backend UUIDs.
 * Backend agent/memory routes require RFC-4122 UUIDs (Pydantic uuid.UUID).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/**
 * Resolve a backend-safe session UUID.
 * - Valid UUID strings pass through (workspace sessions).
 * - Invalid / missing values mint a new UUID (never forward `session_*` / `wf_*`).
 */
export function backendSessionId(raw?: string | null): string {
  if (isUuid(raw)) return raw!.trim();
  return crypto.randomUUID();
}
