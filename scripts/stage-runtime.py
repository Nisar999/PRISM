"""
Stage self-contained runtime for RELEASE-2 NSIS installer.

Output: desktop/src-tauri/resources/runtime/
  backend/python/   copy of backend/.venv (portable-ish)
  backend/.env
  code-oss/node/node.exe
  code-oss/launcher/  @vscode/test-web server
  manifest.json

Runtime resolution is install-dir relative — no PRISM_ROOT.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
# Default: stage into the Tauri bundle resources tree (already on D: because the
# repo lives at D:\Code_yees\PRISM). Override with PRISM_RUNTIME_OUT to stage
# elsewhere (e.g. D:\prism-release-runtime) — then copy/sync into
# desktop/src-tauri/resources/runtime before `tauri build`.
OUT = Path(
    os.environ.get(
        "PRISM_RUNTIME_OUT",
        str(REPO / "desktop" / "src-tauri" / "resources" / "runtime"),
    )
)
BACKEND_SRC = REPO / "backend"
NODE_SRC = REPO / ".tools" / "node24" / "node-v24.18.0-win-x64"


def run(cmd: list[str], cwd: Path | None = None, env: dict | None = None) -> None:
    print("+", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, env=env, check=True)


def robocopy(src: Path, dst: Path) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    # /E copy subdirs, /NFL /NDL /NJH /NJS quiet-ish, /R:1 /W:1
    cmd = [
        "robocopy",
        str(src),
        str(dst),
        "/E",
        "/R:1",
        "/W:1",
        "/NFL",
        "/NDL",
        "/NJH",
        "/NJS",
        "/XD",
        "__pycache__",
        ".pytest_cache",
    ]
    print("+", " ".join(cmd), flush=True)
    # robocopy exit codes 0-7 are success
    code = subprocess.call(cmd)
    if code >= 8:
        raise RuntimeError(f"robocopy failed with code {code}")


def stage_backend() -> None:
    src_venv = BACKEND_SRC / ".venv"
    if not src_venv.exists():
        raise SystemExit(f"Missing {src_venv} — create backend venv first")

    dest = OUT / "backend"
    py_home = dest / "python"
    if py_home.exists():
        shutil.rmtree(py_home)

    print("Copying backend venv (robocopy)…", flush=True)
    robocopy(src_venv, py_home)

    # Ensure prism package is importable (editable installs break when moved).
    pip = py_home / "Scripts" / "pip.exe"
    if pip.exists():
        run([str(pip), "install", "--force-reinstall", "--no-deps", str(BACKEND_SRC)])
        # Reinstall deps only if prism import fails — keep copy of existing site-packages.

    env_dst = dest / ".env"
    env_src = BACKEND_SRC / ".env"
    example = BACKEND_SRC / ".env.example"
    if env_src.exists():
        shutil.copy2(env_src, env_dst)
    elif example.exists():
        shutil.copy2(example, env_dst)
    else:
        env_dst.write_text("PRISM_ENV=production\nPRISM_DEBUG=false\n", encoding="utf-8")

    # Rewrite pyvenv.cfg home to the staged location when possible
    cfg = py_home / "pyvenv.cfg"
    if cfg.exists():
        lines = []
        for line in cfg.read_text(encoding="utf-8").splitlines():
            if line.startswith("home ="):
                # Keep original home (system Python) — required for venv to work
                lines.append(line)
            elif line.startswith("executable ="):
                lines.append(f"executable = {py_home / 'Scripts' / 'python.exe'}")
            else:
                lines.append(line)
        cfg.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("backend staged ->", dest)


def stage_code_oss() -> None:
    dest = OUT / "code-oss"
    node_dir = dest / "node"
    launcher = dest / "launcher"
    if node_dir.exists():
        shutil.rmtree(node_dir)
    node_dir.mkdir(parents=True, exist_ok=True)
    launcher.mkdir(parents=True, exist_ok=True)

    node_exe = NODE_SRC / "node.exe"
    if not node_exe.exists():
        raise SystemExit(f"Missing portable Node: {node_exe}")
    shutil.copy2(node_exe, node_dir / "node.exe")

    # Minimal npm for one-time install into launcher
    for name in ("npm.cmd", "npx.cmd"):
        src = NODE_SRC / name
        if src.exists():
            shutil.copy2(src, node_dir / name)
    npm_js = NODE_SRC / "node_modules" / "npm"
    if npm_js.exists():
        target = node_dir / "node_modules" / "npm"
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            print("Copying npm package…", flush=True)
            robocopy(npm_js, target)

    pkg = launcher / "package.json"
    pkg.write_text(
        json.dumps(
            {
                "name": "prism-code-oss-launcher",
                "private": True,
                "version": "1.0.0",
                "type": "module",
                "dependencies": {"@vscode/test-web": "^0.0.81"},
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    (launcher / "start.mjs").write_text(
        r"""/**
 * Self-contained Code-OSS web for PRISM — no monorepo sources.
 * Prefers bundled vscode-web-cache.tgz (avoids NSIS MAX_PATH on deep trees).
 */
import { createRequire } from 'module';
import { spawn, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const port = process.env.PRISM_CODE_OSS_PORT || '8080';
// Prefer localhost — {{uuid}}.127.0.0.1 is an invalid URL and breaks the extension host
// (blank explorer / ENOPRO). *.localhost resolves in Chromium / WebView2.
const host = process.env.PRISM_CODE_OSS_HOST || 'localhost';
const dataDir = path.join(__dirname, '.vscode-test-web');
const cacheTgz = path.join(__dirname, '..', 'vscode-web-cache.tgz');
const workspaceFolder = (process.env.PRISM_WORKSPACE_FOLDER || '').trim();

function cacheComplete() {
  if (!fs.existsSync(dataDir)) return false;
  for (const name of fs.readdirSync(dataDir)) {
    if (!name.startsWith('vscode-web-')) continue;
    const root = path.join(dataDir, name);
    const amd = path.join(root, 'out', 'vs', 'loader.js');
    const esm = path.join(root, 'out', 'vs', 'workbench', 'workbench.web.main.internal.js');
    const esmCss = path.join(root, 'out', 'vs', 'workbench', 'workbench.web.main.internal.css');
    if (fs.existsSync(amd) || (fs.existsSync(esm) && fs.existsSync(esmCss))) return true;
  }
  return false;
}

function ensureLocalCache() {
  if (cacheComplete()) return;
  // Incomplete trees block @vscode/test-web re-download (version marker present).
  if (fs.existsSync(dataDir)) {
    console.log('[prism-code-oss] removing incomplete vscode-web cache…');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  if (!fs.existsSync(cacheTgz)) return;
  console.log('[prism-code-oss] extracting bundled vscode-web cache…');
  const r = spawnSync('tar', ['-xzf', cacheTgz, '-C', __dirname], {
    windowsHide: true,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error('[prism-code-oss] cache extract failed', r.stderr || r.stdout);
  }
}

ensureLocalCache();

const pkgRoot = path.dirname(require.resolve('@vscode/test-web/package.json'));
const candidates = [
  path.join(pkgRoot, 'out', 'server', 'index.js'),
  path.join(pkgRoot, 'out', 'cli.js'),
  path.join(pkgRoot, 'dist', 'cli.js'),
  path.join(pkgRoot, 'index.js'),
];
const cli = candidates.find((p) => fs.existsSync(p));
if (!cli) {
  console.error('@vscode/test-web CLI not found under', pkgRoot);
  process.exit(1);
}

const args = [
  cli,
  '--host', host,
  '--port', String(port),
  '--browserType', 'none',
  '--quality', 'stable',
  '--testRunnerDataDir', dataDir,
];
// Positional folderPath → vscode-test-web FS provider mount (real Explorer + edit).
if (workspaceFolder && fs.existsSync(workspaceFolder) && fs.statSync(workspaceFolder).isDirectory()) {
  args.push(workspaceFolder);
  console.log('[prism-code-oss] mounting workspace folder');
}
console.log('[prism-code-oss]', process.execPath, args.join(' '));
const child = spawn(process.execPath, args, {
  cwd: __dirname,
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' },
});
child.on('exit', (code) => process.exit(code ?? 1));
""",
        encoding="utf-8",
    )

    env = os.environ.copy()
    env["PATH"] = str(node_dir) + os.pathsep + env.get("PATH", "")
    env["PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD"] = "1"
    env["PUPPETEER_SKIP_DOWNLOAD"] = "1"
    env["npm_config_cache"] = str(Path("D:/npm-cache"))
    env["TEMP"] = "D:\\tmp"
    env["TMP"] = "D:\\tmp"
    Path("D:/npm-cache").mkdir(parents=True, exist_ok=True)
    Path("D:/tmp").mkdir(parents=True, exist_ok=True)
    npm_cmd = node_dir / "npm.cmd"
    if npm_cmd.exists():
        run([str(npm_cmd), "install", "--omit=dev", "--no-fund", "--no-audit", "--ignore-scripts"], cwd=launcher, env=env)
    else:
        run(["npm", "install", "--omit=dev", "--no-fund", "--no-audit", "--ignore-scripts"], cwd=launcher, env=env)

    warm_vscode_web_cache(node_dir / "node.exe", launcher, env)
    pack_vscode_web_cache(launcher)
    print("code-oss staged ->", dest)


def pack_vscode_web_cache(launcher: Path) -> None:
    """Bundle deep vscode-web tree as a single tgz so NSIS avoids MAX_PATH failures."""
    cache = launcher / ".vscode-test-web"
    tgz = launcher.parent / "vscode-web-cache.tgz"
    if not cache.exists():
        print("no vscode-web cache to pack", flush=True)
        return
    if tgz.exists():
        tgz.unlink()
    print("Packing vscode-web-cache.tgz…", flush=True)
    run(["tar", "-czf", str(tgz), "-C", str(launcher), ".vscode-test-web"])
    shutil.rmtree(cache, ignore_errors=True)
    print("packed", tgz, "size_mb", round(tgz.stat().st_size / (1024 * 1024), 1), flush=True)


def _vscode_web_cache_complete(cache: Path) -> bool:
    """Require real workbench bundles — directory / version marker alone is not enough."""
    for p in cache.glob("vscode-web-stable-*") if cache.exists() else []:
        amd = p / "out" / "vs" / "loader.js"
        esm = p / "out" / "vs" / "workbench" / "workbench.web.main.internal.js"
        esm_css = p / "out" / "vs" / "workbench" / "workbench.web.main.internal.css"
        if amd.exists() or (esm.exists() and esm_css.exists()):
            return True
    return False


def warm_vscode_web_cache(node_exe: Path, launcher: Path, env: dict) -> None:
    """Pre-download VS Code Stable web into launcher/.vscode-test-web for offline first run.

    Uses the official web-standalone tarball (curl) instead of streaming through
    @vscode/test-web — partial node downloads left a version marker without out/,
    which caused a permanently blank editor (test-web skips re-download).
    """
    del node_exe, env  # kept for call-site compatibility
    cache = launcher / ".vscode-test-web"

    if _vscode_web_cache_complete(cache):
        print("vscode-web cache already present (complete)", flush=True)
        return

    if cache.exists():
        print("Removing incomplete vscode-web cache…", flush=True)
        shutil.rmtree(cache, ignore_errors=True)

    print("Warming vscode-web cache (official web-standalone tarball)…", flush=True)
    Path("D:/tmp").mkdir(parents=True, exist_ok=True)
    meta_path = Path("D:/tmp/vscode-web-stable-meta.json")
    tar_path = Path("D:/tmp/vscode-web-stable.tar.gz")

    try:
        run(
            [
                "curl",
                "-fsSL",
                "-o",
                str(meta_path),
                "https://update.code.visualstudio.com/api/update/web-standalone/stable/latest",
            ]
        )
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        commit = meta["version"]
        url = meta["url"]
        sha256 = (meta.get("sha256hash") or "").lower()
        print(f"stable commit={commit} url={url}", flush=True)

        run(["curl", "-fL", "--retry", "5", "--retry-delay", "2", "-o", str(tar_path), url])
        size_mb = round(tar_path.stat().st_size / (1024 * 1024), 1)
        print(f"downloaded {size_mb} MB", flush=True)
        if sha256:
            digest = hashlib.sha256(tar_path.read_bytes()).hexdigest()
            if digest != sha256:
                raise RuntimeError(f"vscode-web sha256 mismatch: {digest} != {sha256}")

        folder_name = f"vscode-web-stable-{commit}"
        dest = cache / folder_name
        dest.mkdir(parents=True, exist_ok=True)
        run(["tar", "-xzf", str(tar_path), "-C", str(dest), "--strip-components=1"])
        (dest / "version").write_text(folder_name, encoding="utf-8")
    except Exception as exc:
        print(f"WARNING: vscode-web warm failed: {exc}", flush=True)
        shutil.rmtree(cache, ignore_errors=True)
        return

    ready = _vscode_web_cache_complete(cache)
    print("vscode-web warm ready=" + str(ready), flush=True)
    if not ready:
        print(
            "WARNING: vscode-web cache incomplete — editor will be blank until warm succeeds",
            flush=True,
        )


def write_manifest() -> None:
    (OUT / "manifest.json").write_text(
        json.dumps(
            {
                "version": "1.0.0",
                "backend": {
                    "python": "backend/python/Scripts/python.exe",
                    "cwd": "backend",
                },
                "codeOss": {
                    "node": "code-oss/node/node.exe",
                    "script": "code-oss/launcher/start.mjs",
                    "cwd": "code-oss/launcher",
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )


def main() -> None:
    print("REPO", REPO, flush=True)
    print("OUT ", OUT, flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    stage_backend()
    stage_code_oss()
    write_manifest()
    print("DONE staging runtime", flush=True)


if __name__ == "__main__":
    main()
