/**
 * PRISM product identity — version, tagline, branding asset paths.
 * Visual only; no architecture or intelligence changes.
 */

import logoUrl from '@/assets/branding/PRISM_logo.png';
import elementUrl from '@/assets/branding/PRISM_element.png';
import millyUrl from '@/assets/branding/Milly_Mascot.png';

export const PRODUCT = {
  name: 'PRISM',
  nameLong: 'PRISM Desktop',
  tagline: 'One Mind. Infinite Shapes.',
  productLine: 'Agentic Intelligent Workspace',
  version: '1.0.0-rc.1',
  versionLabel: 'v1.0.0-rc.1',
  constitutionVersion: '1.0 (Locked)',
  architecture: 'PRISM Desktop → intelligence surfaces → editing engine',
  copyright: `© ${new Date().getFullYear()} PRISM`,
  roadmap: [
    'v1 — Agentic Intelligent Workspace (Milly, no voice)',
    'v2 — ADE (optional voice)',
    'Future — Agentic OS',
  ],
} as const;

/** Bundled asset URLs (Vite). Prefer these in React. */
export const brandAssets = {
  logo: logoUrl,
  element: elementUrl,
  milly: millyUrl,
} as const;

/** Public paths for HTML favicon / non-module use. */
export const brandPublic = {
  logo: '/branding/PRISM_logo.png',
  element: '/branding/PRISM_element.png',
  milly: '/branding/Milly_Mascot.png',
  favicon: '/favicon.png',
} as const;

export type LoadingKind =
  | 'default'
  | 'workspace'
  | 'memory'
  | 'intelligence'
  | 'editor'
  | 'milly';

export const LOADING_COPY: Record<LoadingKind, string> = {
  default: 'Loading…',
  workspace: 'Loading workspace…',
  memory: 'Searching memory…',
  intelligence: 'Connecting intelligence…',
  editor: 'Launching workspace…',
  milly: 'Milly is understanding your project…',
};
