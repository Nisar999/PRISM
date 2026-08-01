# PRISM Infrastructure — Sprint R3C Native Build Bootstrap Audit

Last updated: 2026-07-28

**Architecture impact:** ZERO — `scripts/code-oss-web.ps1` only.

---

## 1. Root cause

`Invoke-NativeServe` gated `npm ci` on:

```powershell
if (-not (Test-Path 'node_modules')) { Invoke-Npm ci }
```

A **partial** install left an empty/incomplete `node_modules` directory. The folder check passed as “done,” so the script skipped `npm ci` and ran `compile-web`, which needs `gulp` (and related packages).

**Verified on this machine:**

| Check | Result |
| --- | --- |
| `vscode-main/vscode-main/node_modules` | **Exists** |
| `node_modules/gulp/bin/gulp.js` | **Missing** |

---

## 2. Bootstrap flow (after R3C)

```text
pwsh scripts/code-oss-web.ps1 [-Mode native|auto|docker]
  ├─ docker/auto+Docker → compose (unchanged)
  └─ native / auto without Docker
       → Initialize-NodeToolchain
       → Ensure-NativeNpmDependencies
            ├─ Test-NativeDepsComplete?
            │    required: gulp/bin/gulp.js, .bin/gulp.cmd, typescript/lib/tsc.js
            ├─ if incomplete → npm ci (even when node_modules/ exists)
            └─ re-validate or throw
       → npm run compile-web
       → scripts\code-web.bat --host 127.0.0.1 --port 8080 --browserType none
```

**Rule:** Never treat `Test-Path node_modules` alone as install success.

---

## 3. Code diff (summary)

**File:** `scripts/code-oss-web.ps1`

- Added `Test-NativeDepsComplete` — checks gulp + typescript markers.
- Added `Ensure-NativeNpmDependencies` — runs `npm ci` when markers are missing; re-validates after.
- `Invoke-NativeServe` calls `Ensure-NativeNpmDependencies` before `compile-web`.
- Docker mode unchanged.

---

## 4. Verification steps

```powershell
# Expect incomplete install to trigger npm ci (current tree)
pwsh d:\Code_yees\PRISM\scripts\code-oss-web.ps1 -Mode native -BuildOnly
```

Expect console lines such as:

- `node_modules exists but required packages are missing … Re-running npm ci...`
- then `npm run compile-web`

After a successful install, a second run should print:

- `Native dependencies look complete (gulp + typescript present).`

Optional marker check:

```powershell
Test-Path d:\Code_yees\PRISM\vscode-main\vscode-main\node_modules\gulp\bin\gulp.js
```

---

## 5. Architecture impact

**Zero** — no Desktop, vscode-main source, managers, stores, or backend changes.
