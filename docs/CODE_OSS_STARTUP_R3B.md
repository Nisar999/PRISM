# PRISM Desktop — Sprint R3B Code-OSS Native Startup Fix

Last updated: 2026-07-27

**Architecture impact:** ZERO — `scripts/code-oss-web.ps1` only; no editor, vscode-main, or desktop app changes.

---

## 1. Root cause

In `Invoke-NativeServe`, `npm ci` was started as:

```powershell
& $node (Get-Command npm.cmd).Source ci
```

That expands to:

```text
C:\...\node.exe C:\...\npm.cmd ci
```

`node.exe` treats the first argument as a **JavaScript file**. `npm.cmd` is a **Windows batch/cmd wrapper**, so Node throws:

```text
SyntaxError: Unexpected token ':'
```

(from `::` comments or `@echo` / label syntax inside the `.cmd` file).

---

## 2. Code diff (summary)

**File:** `scripts/code-oss-web.ps1`

- Added `Initialize-NodeToolchain` — prefers repo `.tools\node24\...\node.exe`, prepends its directory to `PATH`.
- Added `Invoke-Npm` — runs `npm.cmd` **directly** (`& $npmCmd @NpmArgs`), never `node.exe npm.cmd`.
- `Invoke-NativeServe` uses `Invoke-Npm ci` and `Invoke-Npm run compile-web`.
- Serve step uses upstream `scripts\code-web.bat` with `--host 127.0.0.1 --port $Port --browserType none`.

---

## 3. Why Node attempted to execute npm.cmd

PowerShell’s call operator `&` with two string operands runs **executable + first argument as script path**. The script passed `npm.cmd` as the script path **to node.exe** instead of executing `npm.cmd` as the program. Only `npm-cli.js` (or similar) is valid as a Node script entry; the `.cmd` shim must be launched by `cmd.exe` via `npm.cmd`.

---

## 4. Correct invocation chain (native, Windows, Node 24)

```text
pwsh scripts/code-oss-web.ps1 -Mode native
  → Initialize-NodeToolchain (.tools\node24 or PATH node)
  → npm.cmd ci                    (via Invoke-Npm)
  → npm.cmd run compile-web       (via Invoke-Npm)
  → scripts\code-web.bat --host 127.0.0.1 --port 8080 --browserType none
       → (bat) npm run download-builtin-extensions
       → (bat) node scripts\code-web.js ...
```

Docker / `auto` paths unchanged.

---

## 5. Code-OSS startup status

| Step | Status |
| --- | --- |
| Script fix | **Applied** |
| `npm ci` / `compile-web` on this machine | **Not re-run here** (long build; requires VS C++ toolchain + vscode `node_modules`) |
| `http://127.0.0.1:8080/` | **Verify locally** after native or Docker serve succeeds |

**Verify after serve:**

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:8080/ -UseBasicParsing -TimeoutSec 5
```

Expect HTTP **200** (or a redirect/HTML body from the workbench).

---

## 6. Architecture impact

**Zero** — startup script only.
