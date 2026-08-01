#!/usr/bin/env node
/**
 * Run a child command with PRISM build caches/outputs forced onto D:.
 *
 * Usage (from desktop/):
 *   node ../scripts/run-with-d-drive.mjs tauri build --no-bundle
 *
 * Env overrides always win if already set by the caller.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const D = {
  CARGO_TARGET_DIR: 'D:\\cargo-target\\prism-desktop',
  PRISM_RUNTIME_OUT: 'D:\\prism-release-runtime',
  NPM_CONFIG_CACHE: 'D:\\PRISM_Caches\\npm',
  PIP_CACHE_DIR: 'D:\\PRISM_Caches\\pip',
  TMP: 'D:\\PRISM_Caches\\temp',
  TEMP: 'D:\\PRISM_Caches\\temp',
};

for (const dir of Object.values(D)) {
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
}

const env = { ...process.env };
for (const [k, v] of Object.entries(D)) {
  // Prefer an explicit caller override unless it points at C: Temp/sandbox.
  const current = env[k];
  const forcesC =
    typeof current === 'string' &&
    (/^[Cc]:\\/i.test(current) ||
      /cursor-sandbox-cache/i.test(current) ||
      /AppData\\Local\\Temp/i.test(current));
  if (!current || forcesC) {
    env[k] = v;
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node run-with-d-drive.mjs <command> [args...]');
  process.exit(2);
}

const command = args[0];
const commandArgs = args.slice(1);
const cwd = process.cwd();

console.log(`[run-with-d-drive] CARGO_TARGET_DIR=${env.CARGO_TARGET_DIR}`);
console.log(`[run-with-d-drive] PRISM_RUNTIME_OUT=${env.PRISM_RUNTIME_OUT}`);
console.log(`[run-with-d-drive] TMP=${env.TMP}`);
console.log(`[run-with-d-drive] cwd=${cwd}`);
console.log(`[run-with-d-drive] $ ${command} ${commandArgs.join(' ')}`);

const child = spawn(command, commandArgs, {
  cwd,
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
