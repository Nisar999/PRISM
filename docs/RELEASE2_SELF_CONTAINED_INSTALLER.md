# PRISM v1 — RELEASE-2 Self-Contained Installer

**Date:** 2026-07-29  
**Architecture impact:** ZERO (presentation/OS bridges + bundled runtime tree only)  
**Artifact:** `D:\cargo-target\prism-desktop\release\bundle\nsis\PRISM_1.0.0_x64-setup.exe` (~122 MB)

---

## 1. Goal

End user installs PRISM and uses it with:

- **No** source tree / monorepo next to the exe  
- **No** `PRISM_ROOT`  
- **No** manual PowerShell / npm / uvicorn  
- Backend (`:8000`) + Code-OSS web (`:8080`) started silently by the shell

---

## 2. Install layout

```
<install>/
  desktop.exe              # PRISM shell (Tauri)
  uninstall.exe
  runtime/
    manifest.json
    backend/
      .env
      python/              # portable venv (Scripts/python.exe + site-packages)
    code-oss/
      node/node.exe
      vscode-web-cache.tgz # pre-fetched VS Code Stable web (~29 MB compressed)
      launcher/
        start.mjs
        package.json
        node_modules/@vscode/test-web/
```

**User data** (not in install dir): `%LOCALAPPDATA%\PRISM`  
- `identity.json`, settings, `runtime-ensure.json`, `logs/`

---

## 3. Runtime architecture

| Concern | Mechanism |
|---------|-----------|
| Path resolution | `find_runtime_dir()` → `<exe_dir>/runtime` (also `resources/runtime`) |
| Backend start | `runtime/backend/python/Scripts/python.exe -m uvicorn prism.main:create_app --factory --host 127.0.0.1 --port 8000` |
| Code-OSS start | `runtime/code-oss/node/node.exe …/launcher/start.mjs` |
| Windowless spawn | `CREATE_NO_WINDOW` + stdin/stdout/stderr → `%LOCALAPPDATA%\PRISM\logs\` |
| Boot hook | `main.tsx` → `ensure_runtime_services` after identity/settings bootstrap |
| Staging | `scripts/stage-runtime.py` → `PRISM_RUNTIME_OUT` (default or `D:\prism-release-runtime`) |
| Bundle map | `tauri.conf.json` → `"../../../../prism-release-runtime": "runtime"` |

### Code-OSS cache strategy

Deep `vscode-web-stable-*` trees exceed NSIS/Windows path limits when embedded as loose files. Staging therefore:

1. Warms `@vscode/test-web` download into `.vscode-test-web/`  
2. Packs it as `code-oss/vscode-web-cache.tgz`  
3. Deletes the deep tree from the stage  
4. `start.mjs` extracts the tgz next to the launcher on first run, then serves via `--testRunnerDataDir`

---

## 4. Startup sequence

1. User launches `desktop.exe`  
2. WebView loads UI; identity + settings hydrate from `%LOCALAPPDATA%\PRISM`  
3. `ensure_runtime_services`:  
   - If `:8000` down → start backend from `runtime/`  
   - If `:8080` down → start Code-OSS launcher (extract cache if needed)  
4. Breadcrumb written to `%LOCALAPPDATA%\PRISM\runtime-ensure.json`  
5. Session restore may reopen last workspace (settingsManager)

---

## 5. Build commands

```powershell
$env:TEMP='D:\tmp'; $env:TMP='D:\tmp'
$env:CARGO_TARGET_DIR='D:\cargo-target\prism-desktop'
$env:PRISM_RUNTIME_OUT='D:\prism-release-runtime'
cd D:\Code_yees\PRISM\desktop
npm run stage:runtime   # or full: npm run release:installer
npm run tauri -- build
```

Output: `D:\cargo-target\prism-desktop\release\bundle\nsis\PRISM_1.0.0_x64-setup.exe`

---

## 6. Clean-profile validation (2026-07-29)

| Step | Result |
|------|--------|
| Silent install `/S /D=D:\prism-validate-install` | exit 0 |
| Layout has `runtime/`, tgz, python, start.mjs | PASS |
| `PRISM_ROOT` unset | PASS |
| Launch `desktop.exe` | process stays alive |
| `:8080` listen | ~18s |
| `:8000` listen | ~30s |
| `GET http://127.0.0.1:8000/docs` | **200** |
| `GET http://127.0.0.1:8080/` | **200** |
| `runtime-ensure.json` | `backend=started`, `codeOss=started`, `runtimeDir=D:\prism-validate-install\runtime` |
| Identity under `%LOCALAPPDATA%\PRISM` | `identity.json` present |

### Manual UI checklist (same install)

- [ ] Open Folder (native dialog)  
- [ ] Edit + Save in Code-OSS host  
- [ ] Close app  
- [ ] Reopen → last workspace restore when enabled  

---

## 7. Known limits

| Item | Notes |
|------|-------|
| Backend soft deps | Postgres/Redis/etc. still required for full API features; process starts without the monorepo |
| First Code-OSS extract | Needs Windows `tar`; bundled tgz avoids network on first run |
| Exe name | Ship as `desktop.exe` (Cargo package name); productName in installer is **PRISM** |
| C: free space | Prefer `CARGO_TARGET_DIR` + `TEMP` on D: when C: is tight |

---

## 8. Key files

| Path | Role |
|------|------|
| `scripts/stage-runtime.py` | Stage backend venv + Code-OSS launcher + vscode-web tgz |
| `desktop/src-tauri/src/lib.rs` | `ensure_runtime_services`, `find_runtime_dir`, log redirects |
| `desktop/src-tauri/tauri.conf.json` | NSIS + resources map |
| `desktop/src/main.tsx` | Boot ensure |
| `desktop/src/lib/identity.ts` | Data under app data dir |

---

## 9. Verdict

**RELEASE-2 complete for self-contained install + silent auto-start.**  
Installer embeds runtime; clean install under `D:\prism-validate-install` brought up backend and Code-OSS without repo or `PRISM_ROOT`.
