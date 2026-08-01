#!/usr/bin/env node
/**
 * Post-build helper: copies the freshly built PRISM executable to a stable,
 * consistent location so CI / QA / users don't have to hunt through Tauri's
 * target folder.
 *
 *   desktop/  →  build/latest/PRISM Desktop.exe
 *
 * Runs after `tauri build` (see package.json `release:installer` / `build:desktop`).
 * Replaces the previous development executable on every successful build.
 */

import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  statSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
// Honor CARGO_TARGET_DIR (e.g. when redirected to a drive with more space).
// Falls back to the default `src-tauri/target/release` otherwise.
const cargoTargetDir = process.env.CARGO_TARGET_DIR
  ? resolve(process.env.CARGO_TARGET_DIR)
  : resolve(__dirname, 'src-tauri', 'target');
const tauriTarget = join(cargoTargetDir, 'release');
const latestDir = resolve(repoRoot, 'build', 'latest');
const destExe = join(latestDir, 'PRISM Desktop.exe');

function findExe() {
  if (!existsSync(tauriTarget)) return null;
  // Cargo binary name is `desktop` (Cargo.toml package name) → desktop.exe.
  // Tauri's productName is "PRISM" → bundled/renamed exe is PRISM.exe in some flows.
  const candidates = ['desktop.exe', 'PRISM.exe', 'prism.exe'];
  for (const name of candidates) {
    const p = join(tauriTarget, name);
    if (existsSync(p)) return p;
  }
  // Fallback: any large .exe in the release dir that isn't a known helper.
  const helpers = new Set(['prism_launcher.exe']);
  for (const entry of readdirSync(tauriTarget)) {
    if (!entry.toLowerCase().endsWith('.exe')) continue;
    if (helpers.has(entry.toLowerCase())) continue;
    const p = join(tauriTarget, entry);
    try {
      if (statSync(p).size > 1_000_000) return p; // main exe is multi-MB
    } catch {
      /* ignore */
    }
  }
  return null;
}

function main() {
  const src = findExe();
  if (!src) {
    console.error('[copy-latest-build] No built executable found under', tauriTarget);
    console.error('               Did `tauri build` succeed?');
    process.exit(1);
  }

  mkdirSync(latestDir, { recursive: true });
  // Replace any previous copy (Windows may hold a lock if the previous exe is running).
  try {
    if (existsSync(destExe)) rmSync(destExe, { force: true });
  } catch (err) {
    console.warn('[copy-latest-build] Could not remove previous exe (locked?):', err.message);
  }
  copyFileSync(src, destExe);

  const manifest = {
    name: 'PRISM Desktop',
    exe: 'PRISM Desktop.exe',
    source: src.replace(repoRoot + '\\', '').replace(/\\/g, '/'),
    builtAt: new Date().toISOString(),
  };
  writeFileSync(join(latestDir, 'build.json'), JSON.stringify(manifest, null, 2));

  console.log(`[copy-latest-build] OK ${manifest.source} -> build/latest/PRISM Desktop.exe`);
  console.log(`[copy-latest-build]    built at ${manifest.builtAt}`);
}

main();
