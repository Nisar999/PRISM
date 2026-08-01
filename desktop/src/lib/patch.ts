/**
 * Patch helpers — unified diff generation / parsing / apply.
 * Not a manager: pure functions used by the Code Modification workflow.
 */

export interface FilePatch {
  path: string;
  /** Relative to project root */
  relativePath: string;
  original: string;
  proposed: string;
  unifiedDiff: string;
  additions: number;
  deletions: number;
  status: 'pending' | 'accepted' | 'rejected';
  /** true when file did not exist before */
  isNew: boolean;
}

export interface ParsedProposal {
  files: Omit<FilePatch, 'status' | 'path' | 'additions' | 'deletions' | 'unifiedDiff'> & {
    relativePath: string;
    original: string;
    proposed: string;
  }[];
  source: 'agent';
  planSummary: string;
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function splitLines(text: string): string[] {
  const n = normalizeNewlines(text);
  if (n === '') return [];
  return n.split('\n');
}

/** Simple LCS-based unified diff (file-level). */
export function generateUnifiedDiff(
  relativePath: string,
  original: string,
  proposed: string,
): { diff: string; additions: number; deletions: number } {
  const a = splitLines(original);
  const b = splitLines(proposed);
  const m = a.length;
  const n = b.length;

  // LCS lengths
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const hunks: string[] = [];
  let additions = 0;
  let deletions = 0;
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      hunks.push(` ${a[i]}`);
      i++;
      j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      hunks.push(`+${b[j]}`);
      additions++;
      j++;
    } else if (i < m) {
      hunks.push(`-${a[i]}`);
      deletions++;
      i++;
    }
  }

  const header = [
    `--- a/${relativePath}`,
    `+++ b/${relativePath}`,
    `@@ -1,${Math.max(a.length, 1)} +1,${Math.max(b.length, 1)} @@`,
  ];
  return {
    diff: [...header, ...hunks].join('\n'),
    additions,
    deletions,
  };
}

export function joinProjectPath(projectPath: string, relativePath: string): string {
  const rel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return `${projectPath.replace(/\\/g, '/').replace(/\/+$/, '')}/${rel}`;
}

/**
 * Extract candidate file edits from agent free-text.
 * Supports:
 * - ```diff unified patches
 * - ```lang path/to/file blocks (full-file replacement)
 * - FILE: path\\n```...``` blocks
 */
export function parseAgentEditProposals(
  text: string,
): { relativePath: string; proposed: string; fromDiff: boolean }[] {
  const out: { relativePath: string; proposed: string; fromDiff: boolean }[] = [];
  const seen = new Set<string>();

  const push = (rel: string, proposed: string, fromDiff: boolean) => {
    const path = rel.replace(/\\/g, '/').replace(/^\.\//, '').trim();
    if (!path || path.includes('..')) return;
    if (seen.has(path)) return;
    seen.add(path);
    out.push({ relativePath: path, proposed: normalizeNewlines(proposed), fromDiff });
  };

  // Unified diff fences
  const diffFence =
    /```(?:diff|patch)?\s*\n([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = diffFence.exec(text)) !== null) {
    const body = m[1];
    if (!/^---\s+/m.test(body) || !/^\+\+\+\s+/m.test(body)) continue;
    const parsed = applyUnifiedDiffToContents(body);
    for (const f of parsed) {
      push(f.relativePath, f.proposed, true);
    }
  }

  // FILE: path then fenced body
  const fileMarker =
    /(?:^|\n)FILE:\s*([^\n]+)\n```[\w.-]*\n([\s\S]*?)```/gi;
  while ((m = fileMarker.exec(text)) !== null) {
    push(m[1].trim(), m[2].replace(/\n$/, ''), false);
  }

  // ```ext path/to/file\n...\n```
  const pathFence =
    /```[\w.-]*\s+([A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+)\s*\n([\s\S]*?)```/g;
  while ((m = pathFence.exec(text)) !== null) {
    push(m[1], m[2].replace(/\n$/, ''), false);
  }

  return out;
}

/** Minimal unified-diff applicator for agent-produced patches (full-file hunks). */
function applyUnifiedDiffToContents(
  diffText: string,
): { relativePath: string; proposed: string }[] {
  const lines = splitLines(diffText);
  const files: { relativePath: string; proposed: string }[] = [];
  let currentPath = '';
  let proposedLines: string[] = [];
  let inHunk = false;

  const flush = () => {
    if (currentPath) {
      files.push({ relativePath: currentPath, proposed: proposedLines.join('\n') });
    }
    currentPath = '';
    proposedLines = [];
    inHunk = false;
  };

  for (const line of lines) {
    if (line.startsWith('+++ ')) {
      const raw = line.slice(4).trim().replace(/^b\//, '');
      if (currentPath && currentPath !== raw) flush();
      currentPath = raw;
      proposedLines = [];
      inHunk = false;
      continue;
    }
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }
    if (!inHunk || !currentPath) continue;
    if (line.startsWith('+')) {
      proposedLines.push(line.slice(1));
    } else if (line.startsWith('-')) {
      // omit from proposed
    } else if (line.startsWith(' ')) {
      proposedLines.push(line.slice(1));
    } else if (line === '\\ No newline at end of file') {
      // ignore
    }
  }
  flush();
  return files;
}

export function countDiffStats(diff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of splitLines(diff)) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }
  return { additions, deletions };
}
