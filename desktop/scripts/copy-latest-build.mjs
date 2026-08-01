#!/usr/bin/env node
/**
 * Post-build helper: copies the freshly built PRISM executable to a stable,
 * consistent location so CI / QA / users don't have to hunt through Tauri's
 * target folder.
 *
 *   desktop/  →  build/latest/PRISM Desktop.exe
 *            →  build/latest/runtime/   (editing-engine + backend sidecar)
 *
 * Runs after `tauri build` (see package.json `release:installer` / `build:desktop`).
 * Replaces the previous development executable on every successful build.
 */

import {
  existsSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  readdirSync,
  statSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const cargoTargetDir = process.env.CARGO_TARGET_DIR
  ? resolve(process.env.CARGO_TARGET_DIR)
  : resolve(__dirname, 'src-tauri', 'target');
const tauriTarget = join(cargoTargetDir, 'release');
const latestDir = resolve(repoRoot, 'build', 'latest');
const destExe = join(latestDir, 'PRISM Desktop.exe');
const runtimeSrcCandidates = [
  process.env.PRISM_RUNTIME_OUT ? resolve(process.env.PRISM_RUNTIME_OUT) : null,
  resolve(__dirname, 'src-tauri', 'resources', 'runtime'),
].filter(Boolean);

function findExe() {
  if (!existsSync(tauriTarget)) return null;
  const candidates = ['desktop.exe', 'PRISM.exe', 'prism.exe'];
  for (const name of candidates) {
    const p = join(tauriTarget, name);
    if (existsSync(p)) return p;
  }
  const helpers = new Set(['prism_launcher.exe']);
  for (const entry of readdirSync(tauriTarget)) {
    if (!entry.toLowerCase().endsWith('.exe')) continue;
    if (helpers.has(entry.toLowerCase())) continue;
    const p = join(tauriTarget, entry);
    try {
      if (statSync(p).size > 1_000_000) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function syncRuntimeBesideExe() {
  const destRuntime = join(latestDir, 'runtime');
  const src = runtimeSrcCandidates.find(
    (p) =>
      p &&
      existsSync(p) &&
      (existsSync(join(p, 'manifest.json')) || existsSync(join(p, 'code-oss'))),
  );
  if (!src) {
    console.warn(
      '[copy-latest-build] No staged runtime found — editor sidecar will be unavailable until stage:runtime',
    );
    return false;
  }
  mkdirSync(destRuntime, { recursive: true });
  cpSync(src, destRuntime, { recursive: true, force: true });
  const cache = existsSync(join(destRuntime, 'code-oss', 'vscode-web-cache.tgz'));
  console.log(
    `[copy-latest-build] runtime synced from ${src} (vscode-web-cache=${cache ? 'yes' : 'missing'})`,
  );
  return true;
}

function main() {
  const src = findExe();
  if (!src) {
    console.error('[copy-latest-build] No built executable found under', tauriTarget);
    console.error('               Did `tauri build` succeed?');
    process.exit(1);
  }

  mkdirSync(latestDir, { recursive: true });
  try {
    if (existsSync(destExe)) rmSync(destExe, { force: true });
  } catch (err) {
    console.warn('[copy-latest-build] Could not remove previous exe (locked?):', err.message);
  }
  copyFileSync(src, destExe);
  const runtimeOk = syncRuntimeBesideExe();

  const manifest = {
    name: 'PRISM Desktop',
    exe: 'PRISM Desktop.exe',
    source: src.replace(repoRoot + '\\', '').replace(/\\/g, '/'),
    builtAt: new Date().toISOString(),
    runtime: runtimeOk,
  };
  writeFileSync(join(latestDir, 'build.json'), JSON.stringify(manifest, null, 2));

  console.log(`[copy-latest-build] OK ${manifest.source} -> build/latest/PRISM Desktop.exe`);
  console.log(`[copy-latest-build]    built at ${manifest.builtAt}`);
}

main();
