# PRISM Infrastructure — Sprint ENV-5 Repository Recovery & Bootstrap Repair

Last updated: 2026-07-28

**Architecture impact:** ZERO — Git metadata recovery + migration tooling only. No PRISM Desktop, no vscode application source patches, postinstall left enabled.

---

## 1. Root cause

`D:\Code_yees\PRISM\vscode-main\vscode-main` contains a full Code-OSS / VS Code **1.131.0** source tree but **no `.git` directory**.

Origin classification: **ZIP download / copied folder** (not an incomplete clone, not a detached worktree). Evidence:

| Check | Result |
| --- | --- |
| `.git` present | **No** |
| `git status` / `git rev-parse --show-toplevel` | Fail: not a git directory |
| Upstream markers (`.github`, `.gitignore`, `LICENSE.txt`) | Present |
| `package.json` version | `1.131.0` |
| `package.json` distro | `d0fd3324a737f695bd14f2aee3ca92accd28870f` |
| Tag `1.131.0` on `microsoft/vscode` | **Does not exist** (release tags jump 1.130.0 → later; 1.131 was a mainline window) |

`npm ci` → `build/npm/postinstall.ts` runs:

```ts
child_process.execSync('git config pull.rebase merges');
```

That requires a real Git repository. Without `.git`, install fails after native modules may already have built.

MSVC / Spectre (ENV-3/4) is a separate, already-solved constraint: set process-local `VCToolsVersion=14.44.35207` (Spectre libs under VS 18 BuildTools).

---

## 2. Recovery strategy

**Do not delete the workspace.** Preserve every local byte.

**Chosen strategy: in-place Git attach** (default in `scripts/recover-vscode-git.ps1`):

1. Resolve the upstream commit whose `package.json` **exactly matches** the local tree:
   - Commit: `1e27930ef9c9f14e1beb8fb2a629b966333deeaf`
   - Identity: last `1.131.0` commit (parent of `Bump version to 1.132.0`)
   - Local vs remote `package.json` SHA256: **identical**
2. `git init` inside the existing tree
3. `git remote add origin https://github.com/microsoft/vscode.git`
4. `git fetch --depth 1 origin <commit>`
5. `git reset --mixed FETCH_HEAD` — updates HEAD + index only; **working tree untouched**

Fallback (optional): `-FreshCloneSwap` clones a sibling tree, overlays local-only/modified files, renames current tree to a timestamped backup, then swaps.

**Not used:** patching/disabling postinstall, deleting local sources, or `git checkout -f` (would overwrite customizations).

---

## 3. Migration script

```powershell
pwsh -NoProfile -File D:\Code_yees\PRISM\scripts\recover-vscode-git.ps1
# Optional:
#   -Ref <commit|tag>          # default: 1e27930ef9c9f14e1beb8fb2a629b966333deeaf
#   -FreshCloneSwap            # clone + overlay + swap instead of in-place
#   -SkipSwap                  # with FreshCloneSwap: stop before rename
#   -Force                     # re-attach even if .git exists
```

Outputs:

- Diff report: `docs/VSCODE_GIT_RECOVERY_DIFF_<stamp>.md`
- Manifest: `vscode-main/recovery-manifest-<stamp>.txt`

---

## 4. Automatic compare (current vs attached upstream)

From recovery run `20260728-211425` (excludes `node_modules` / `out` / `.git` from the report):

| Category | Count |
| --- | ---: |
| Added (local-only) | 21 |
| Modified vs upstream | 435 |
| Deleted vs upstream | 90 |

Interpretation:

- **Added / modified / deleted** are preserved on disk (in-place attach never deletes working-tree files).
- Many “modified” entries are expected for a ZIP-sourced tree (line endings, packaging skew, optional Microsoft-internal paths). **PRISM product customizations remain outside this tree** (`scripts/`, `desktop/`, `docker/`, `docs/`) per prior integration status.
- No overlay copy was required for the default path; local files already remain in place.

---

## 5. Validation steps

```powershell
cd D:\Code_yees\PRISM\vscode-main\vscode-main
git rev-parse --show-toplevel   # expect this path
git status -sb                  # must succeed

# Spectre-capable toolset (ENV-4)
$env:VCToolsVersion = '14.44.35207'

npm ci
npm run compile-web
```

Stop after `compile-web` (ENV-5 scope).

---

## 6. Final build status

| Step | Status |
| --- | --- |
| Git recovery (`git status`) | **PASS** — toplevel `D:/Code_yees/PRISM/vscode-main/vscode-main`, HEAD `1e27930ef9c9f14e1beb8fb2a629b966333deeaf` |
| `npm ci` | **PASS** (Node 24.18.0 from `.tools/node24`, `VCToolsVersion=14.44.35207`, host `vscode-main/Directory.Build.props` disables MSBuild file tracker) |
| `npm run compile-web` / gulp `compile-web` | **PASS** (exit 0) with host `NODE_OPTIONS=--require .tools/fix-win-fileurl-paths.cjs` |

### Host-only notes (not vscode-main patches)

1. **Node:** use `.tools/node24/node-v24.18.0-win-x64` on PATH (preinstall rejects Node 22).
2. **Spectre / MSVC:** `$env:VCToolsVersion='14.44.35207'` under VS 18 BuildTools.
3. **MSBuild TRK0002:** `vscode-main/Directory.Build.props` sets `TrackFileAccess=false` (walks up into `node_modules` builds; no app source change).
4. **Windows `file://` strip bug** in upstream `extensions/html-language-features/esbuild.browser.mts` (`.replace('file://','')` → `D:\D:\...`). Fixed at host via `.tools/fix-win-fileurl-paths.cjs` — **vscode-main not modified**.

Example compile-web invocation after recovery:

```powershell
$env:VCToolsVersion = '14.44.35207'
$env:Path = "D:\Code_yees\PRISM\.tools\node24\node-v24.18.0-win-x64;$env:Path"
$env:NODE_OPTIONS = '--require D:\Code_yees\PRISM\.tools\fix-win-fileurl-paths.cjs'
cd D:\Code_yees\PRISM\vscode-main\vscode-main
node --experimental-strip-types --max-old-space-size=8192 ./node_modules/gulp/bin/gulp.js compile-web
```

---

## Constraints checklist

| Constraint | Honored |
| --- | --- |
| No PRISM architecture changes | Yes |
| No vscode-main source patches to bypass Git | Yes |
| Postinstall not disabled | Yes |
| Git-dependent functionality preserved | Yes |
| No patching generated `node_modules` | Yes |
| Local customizations preserved | Yes (in-place working tree) |
| Architecture impact | **ZERO** |
