/**
 * Milly Workspace views — center editor tabs (not Code-OSS tabs).
 * Mirror is intentionally absent here — it belongs in Settings → Mirror.
 */

export type MillyViewId = 'prism' | 'globe';

export interface MillyViewPane {
  id: MillyViewId;
  label: string;
  path: string;
}

export const MILLY_VIEWS: Record<MillyViewId, MillyViewPane> = {
  prism: { id: 'prism', label: 'PRISM View', path: '/views/prism' },
  globe: { id: 'globe', label: 'Globe View', path: '/views/globe' },
};

export const MILLY_VIEW_IDS: MillyViewId[] = ['prism', 'globe'];

export function isMillyViewId(id: string): id is MillyViewId {
  return id === 'prism' || id === 'globe';
}

export function millyViewFromPath(pathname: string): MillyViewId | null {
  if (pathname.startsWith('/views/prism')) return 'prism';
  if (pathname.startsWith('/views/globe')) return 'globe';
  return null;
}
