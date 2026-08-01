# PRISM C: → D: Development Drive Migration Report

**Date:** 2026-08-01  
**Scope:** Development / build artifacts only. No application features, UI, backend behavior, or architecture changes.  
**Policy:** Nothing permanently deleted. MOVE_TO_D items relocated to `D:\PRISM_Migration_Review\`. KEEP_ON_C items remain (some snapshotted for review).

---

## 1. Disk space

| Drive | Before (approx) | After |
|-------|-----------------|-------|
| **C:** | ~18.9 GB free / 433.1 GB used | **19.0 GB free** / 433.0 GB used |
| **D:** | ~305.9 GB free / 194.1 GB used | **305.2 GB free** / 194.8 GB used |

Net: ~127 MB of PRISM-specific build cache moved off C:; cargo registry **seeded** onto D: (~361 MB copy, original still on C until you approve removal). Future Cargo/npm/pip/temp write to D:.

---

## 2. Classification table

| Location | Size | Purpose | Classification | Reason |
|----------|------|---------|----------------|--------|
| `C:\Users\N1G4\AppData\Local\node-gyp-prism` | 120.8 MB | PRISM-specific node-gyp rebuild cache | **MOVE_TO_D** | Pure PRISM build artifact | ✅ Moved → `D:\PRISM_Migration_Review\NodeCache\node-gyp-prism` |
| `C:\Users\N1G4\AppData\Local\tauri` (NSIS) | 6.8 MB | Tauri NSIS toolchain cache | **MOVE_TO_D** | Desktop installer build cache | ✅ Moved → `D:\PRISM_Migration_Review\BuildArtifacts\tauri` |
| Cursor sandbox `cargo-target` under `AppData\Local\Temp\cursor-sandbox-cache\...` | (ephemeral) | Agent-forced Cargo target | **MOVE_TO_D** (when present) | Was filling C: during agent builds | Absent at audit time; future builds overridden to D: |
| `C:\Users\N1G4\.cargo` (registry) | ~532 MB (registry 362 MB + bin 171 MB) | Shared Rust package cache + cargo.exe | **OPTIONAL** | Shared by all Rust projects; bin must stay reachable | Registry **seeded** to `D:\PRISM_Caches\cargo`; bin **KEEP_ON_C** |
| `C:\Users\N1G4\.rustup` | ~1.3 GB | Rust toolchain | **KEEP_ON_C** | Toolchain install; moving requires `RUSTUP_HOME` + PATH surgery | Left in place |
| `C:\Users\N1G4\AppData\Local\npm-cache` | ~11 GB | Shared npm cache (all projects) | **OPTIONAL** | Not PRISM-only | Left on C:; PRISM builds redirect to `D:\PRISM_Caches\npm` |
| `C:\Users\N1G4\AppData\Local\pip` | ~8 GB | Shared pip cache | **OPTIONAL** | Not PRISM-only | Left on C:; PRISM builds redirect to `D:\PRISM_Caches\pip` |
| `C:\Users\N1G4\AppData\Roaming\npm` | ~1.6 GB | Global npm packages | **KEEP_ON_C** / OPTIONAL | Shared CLI tools | Left in place |
| `C:\Users\N1G4\AppData\Local\PRISM` | 0.3 MB | Runtime identity, sessions, logs | **KEEP_ON_C** | Live app data (not a build artifact) | Snapshotted to review; original kept |
| `C:\Users\N1G4\AppData\Local\app.prism.desktop` | 94.1 MB | WebView2 profile for running app | **KEEP_ON_C** | Runtime browser profile | Snapshotted to review; original kept |
| `D:\cargo-target\prism-desktop` | ~2.45 GB | Cargo / Tauri release target | Already on D: | Primary target | ✅ In use |
| `D:\Code_yees\PRISM\build\latest\` | 18.1 MB | Stable desktop exe copy | Already on D: | Repo lives on D: | ✅ Verified |
| `D:\Code_yees\PRISM\desktop\src-tauri\resources\runtime` | 359.5 MB | Staged installer runtime | Already on D: | Repo on D: | ✅ |
| `D:\Code_yees\PRISM\desktop\node_modules` | 135 MB | Desktop deps | Already on D: | — | ✅ |
| `D:\Code_yees\PRISM\backend\.venv` | 358 MB | Python venv | Already on D: | — | ✅ |
| `D:\Code_yees\PRISM\desktop\dist` | 12.6 MB | Vite frontend output | Already on D: | — | ✅ |

---

## 3. Files / folders moved into `D:\PRISM_Migration_Review\`

```
D:\PRISM_Migration_Review\
├─ BuildArtifacts\tauri\          (from C:\...\Local\tauri)           6.8 MB
├─ NodeCache\node-gyp-prism\      (from C:\...\Local\node-gyp-prism) 120.8 MB
├─ AppData_PRISM_Snapshots\
│  ├─ PRISM\                      (snapshot; original KEEP_ON_C)
│  └─ app.prism.desktop\          (snapshot; original KEEP_ON_C)
├─ CargoCache\                    (reserved)
├─ RustTarget\                    (reserved)
├─ PythonCache\                   (reserved)
├─ Runtime\                       (reserved)
├─ Temp\                          (reserved)
├─ Unknown\                       (reserved — unused this pass)
└─ migration_manifest.json
```

**Nothing was permanently deleted.** Sources for MOVE_TO_D items were relocated (robocopy `/MOVE`). KEEP_ON_C items were only snapshotted.

---

## 4. Future-build configuration (D: primary)

| Mechanism | Path / value |
|-----------|----------------|
| Cargo target (committed) | `desktop/src-tauri/.cargo/config.toml` → `D:/cargo-target/prism-desktop` |
| User env (persisted) | `CARGO_TARGET_DIR=D:\cargo-target\prism-desktop` |
| User env (persisted) | `NPM_CONFIG_CACHE=D:\PRISM_Caches\npm` |
| User env (persisted) | `PIP_CACHE_DIR=D:\PRISM_Caches\pip` |
| User env (persisted) | `PRISM_RUNTIME_OUT=D:\prism-release-runtime` |
| Session helper | `scripts/dev-env.ps1` (optional `-Persist`) |
| Build wrapper | `scripts/run-with-d-drive.mjs` — overrides C:/sandbox env during builds |
| npm scripts | `desktop/package.json` `build:desktop`, `release:installer`, `stage:runtime`, `copy-latest-build` all go through the wrapper |
| Temp during PRISM builds | `D:\PRISM_Caches\temp` (session / wrapper only — **not** user-wide TEMP) |

**Note:** User-wide `TMP`/`TEMP` were briefly persisted then **cleared** so other Windows apps keep using the normal C: temp directory. PRISM builds still force temp onto D: via the wrapper.

---

## 5. Build verification

| Build | Result | Artifact location |
|-------|--------|-------------------|
| Frontend (`npm run build` via wrapper) | ✅ exit 0 | `D:\Code_yees\PRISM\desktop\dist\` |
| Backend import | ✅ `BACKEND_OK` | `D:\Code_yees\PRISM\backend\` (venv already on D:) |
| Desktop (`npm run build:desktop`) | ✅ exit 0 (~2 min) | **`D:\cargo-target\prism-desktop\release\desktop.exe`** (18.1 MB) |
| Stable exe copy | ✅ | **`D:\Code_yees\PRISM\build\latest\PRISM Desktop.exe`** |

Log confirmation:

```
Built application at: D:\cargo-target\prism-desktop\release\desktop.exe
[copy-latest-build] OK D:/cargo-target/prism-desktop/release/desktop.exe -> build/latest/PRISM Desktop.exe
```

`C:\Users\N1G4\AppData\Local\node-gyp-prism` and `...\tauri` are **MISSING** after move (expected).

---

## 6. Hardcoded C: references in the repository

| File | Finding | Action |
|------|---------|--------|
| `docs/RELEASE2_SELF_CONTAINED_INSTALLER.md` | Documents `D:\cargo-target\...` (already D:) | No change needed |
| `docs/NATIVE_DESKTOP_READINESS.md` | Recommends `CARGO_TARGET_DIR` on D: | No change needed |
| `docs/IMPLEMENTATION_AUDIT.md` | Historical note about C: disk-full failure | Left as history |
| `docs/CODE_OSS_STARTUP_R3B.md` | Generic `C:\...\node.exe` example | Historical; left |
| `scripts/stage-runtime.py` | Default OUT under repo (already on D:) | Clarified comments |
| `desktop/scripts/copy-latest-build.mjs` | Honors `CARGO_TARGET_DIR` | Already correct |
| New: `scripts/run-with-d-drive.mjs`, `scripts/dev-env.ps1`, `.cargo/config.toml` | Force D: | Added |

No application source under `backend/prism` or `desktop/src` hardcodes `C:\` build paths.

---

## 7. Items left on C: (and why)

| Item | Why it remains |
|------|----------------|
| `.rustup` (~1.3 GB) | Toolchain; KEEP_ON_C unless you want a full rustup relocate |
| `.cargo\bin` (+ registry until you delete) | `cargo.exe` / rustup shims; registry optional to delete after you verify D: cache |
| Shared `npm-cache` (~11 GB) / `pip` (~8 GB) | Machine-wide; PRISM redirected to D: caches going forward |
| `AppData\Local\PRISM` | Live identity/session — required for the running app |
| `AppData\Local\app.prism.desktop` | Live WebView2 profile — required for the running app |
| Cursor agent sandboxes | May still inject C: overrides inside Cursor; wrapper + `.cargo/config.toml` + user env mitigate this for normal / scripted builds |

---

## 8. Potentially removable (after your manual review)

After you inspect `D:\PRISM_Migration_Review\`, candidates for permanent delete **from the review folder** (and optionally from C: if still present):

1. `NodeCache\node-gyp-prism` — regenerable on next native rebuild  
2. `BuildArtifacts\tauri` — regenerable on next NSIS bundle  
3. `AppData_PRISM_Snapshots\*` — duplicates of live app data; safe to delete the *snapshots* only  
4. `C:\Users\N1G4\.cargo\registry` — only after confirming builds work with `CARGO_HOME=D:\PRISM_Caches\cargo` (not enabled by default)

**Do not delete** live `AppData\Local\PRISM` or `app.prism.desktop` unless you intend to reset the installed app's profile.

---

## 9. Success criteria checklist

| Criterion | Status |
|-----------|--------|
| PRISM builds successfully | ✅ Frontend + desktop + backend |
| Desktop executable produced on D: | ✅ `D:\cargo-target\prism-desktop\release\desktop.exe` |
| Cargo target on D: | ✅ config + env + verified build path |
| Runtime staging on D: | ✅ in-repo resources already on D:; `PRISM_RUNTIME_OUT` defaults available on D: |
| Temporary build artifacts on D: (PRISM builds) | ✅ wrapper → `D:\PRISM_Caches\temp` |
| No unnecessary PRISM-generated build files remain on C: | ✅ node-gyp-prism + tauri moved; shared toolchains/caches intentionally retained |
| Detailed migration report | ✅ this document |

---

## 10. How to build going forward

```powershell
# Optional: load session env
. D:\Code_yees\PRISM\scripts\dev-env.ps1

cd D:\Code_yees\PRISM\desktop
npm run build:desktop
# → D:\cargo-target\prism-desktop\release\desktop.exe
# → D:\Code_yees\PRISM\build\latest\PRISM Desktop.exe
```

Open a **new** terminal after the User env persistence so `CARGO_TARGET_DIR` / npm / pip caches pick up without the script.
