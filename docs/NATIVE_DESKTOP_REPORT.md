# PRISM Native Desktop Report (Tauri R2)

Last updated: 2026-07-27

## Summary

PRISM Desktop runs as a **Tauri v2** native app from `desktop/`. The web UI is served by Vite in dev (`http://127.0.0.1:1420`); the native shell loads that URL and exposes filesystem commands via Rust (`read_file_string`, `write_file_string`, `create_dir_all`, `read_dir_contents`).

| Check | Status |
| --- | --- |
| Node / npm | OK (`v22.19.0` / `10.9.3`) |
| Rust toolchain | OK (`rustc 1.97.1`, `cargo 1.97.1`, `rustup 1.29.0`) |
| Tauri CLI | OK (`tauri-cli 2.11.4`) |
| `npm install` | OK |
| `npm run build` (frontend) | OK |
| `npm run tauri dev` | OK (after `icon.ico` fix) |
| Native window (automated) | Process starts (`desktop.exe`); **UI/filesystem checks require manual confirmation** |

## Environment prerequisites (Windows)

1. **Microsoft C++ Build Tools** — Desktop development with C++, Windows SDK, MSVC v143.
2. **Rust (rustup)** — [https://rustup.rs/](https://rustup.rs/) or `win.rustup.rs/x86_64` installer.
3. **WebView2 Runtime** — Usually preinstalled on Windows 10/11; [Evergreen bootstrapper](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) if the window is blank or fails to create.
4. **Node.js 18+** — Project tested with Node 22.

### PATH: `rustc` not found in a new terminal

If `rustc` works only as `%USERPROFILE%\.cargo\bin\rustc.exe`, rustup is installed but **Cargo bin is not on PATH** for that session.

**Fix (recommended):**

1. Close **all** terminals and **restart Cursor** (or sign out/in).
2. Open a new terminal and run:
   ```powershell
   rustc --version
   cargo --version
   ```

**Fix (manual, permanent):**

1. Press `Win`, type **Environment Variables**, open **Edit the system environment variables**.
2. **Environment Variables…** → under **User variables**, select **Path** → **Edit**.
3. **New** → add: `%USERPROFILE%\.cargo\bin`
4. OK → OK → new terminal → verify `rustc --version`.

## Project layout (Tauri)

| Path | Role |
| --- | --- |
| `desktop/package.json` | Scripts: `dev`, `build`, `tauri` |
| `desktop/src-tauri/tauri.conf.json` | `beforeDevCommand`, `devUrl`, window size, icons |
| `desktop/src-tauri/capabilities/default.json` | `core:default`, `opener:default` |
| `desktop/src-tauri/src/lib.rs` | FS invoke commands |
| `desktop/src/lib/workspace.ts` | `WorkspaceManager` → Tauri invoke when `__TAURI_INTERNALS__` present |

### `tauri.conf.json` (dev)

- **beforeDevCommand:** `npm run dev`
- **devUrl:** `http://127.0.0.1:1420`
- **Window:** 1280×800 (min 960×640), title **PRISM Desktop**

## Startup sequence

From repository root:

```powershell
cd d:\Code_yees\PRISM\desktop
npm install
npm run tauri dev
```

What happens:

1. Tauri runs `npm run dev` → Vite on port **1420**.
2. Cargo builds `src-tauri` (first run: several minutes; downloads crates).
3. **`desktop.exe`** opens the WebView2 window loading the dev URL.

Production build (not required for daily dev):

```powershell
npm run tauri build
```

Artifacts under `desktop/src-tauri/target/release/` (and bundle output per Tauri config).

## Environment variables (frontend)

| Variable | Purpose |
| --- | --- |
| `VITE_AUTH_BACKEND_URL` | If unset, auth UI shows empty/disabled submit (by design). |
| Standard Vite vars | See `desktop/src/vite-env.d.ts`. |

No Rust env vars are required for default dev.

## Runtime blocker fixed (R2)

**Symptom:** `error RC2175 : resource file ... icon.ico is not in 3.00 format`

**Cause:** `desktop/src-tauri/icons/icon.ico` was invalid (~908 bytes, not a real ICO).

**Fix applied:**

```powershell
cd d:\Code_yees\PRISM\desktop
npx tauri icon ".\src-tauri\icons\icon.png" -o ".\src-tauri\icons"
```

Then re-run `npm run tauri dev`.

## Manual validation checklist (native window)

Perform these in the **Tauri window** (not the browser tab at `:1420` alone).

### Shell & navigation

- [ ] Splash → Home (landing) after load
- [ ] Sidebar: **Home**, **Conversation**, **Workspace**, **Editor**, **Settings**
- [ ] **StatusBar** visible at bottom
- [ ] Trigger a notification (e.g. profile/provider action) — single toast, no duplicate spam within 5s

### Screens

- [ ] **Home** — welcome, composer, recent items, provider strip
- [ ] **Conversation** — chat hub layout
- [ ] **Workspace** — hub sidebar / panels
- [ ] **Editor** — empty state when no workspace; opens after workspace action
- [ ] **Settings** — page renders

### Filesystem (WorkspaceManager + Tauri)

Use **Workspace** flow to create/open a project on disk (or existing PRISM workspace folder):

- [ ] **Create** workspace folder + `project.json` (or equivalent) on disk
- [ ] **Read** — reopen workspace; data persists after app restart
- [ ] **Write** — session/artifact save updates files
- [ ] **Delete** — remove artifact/session if exposed in UI; confirm file gone in Explorer

If FS fails, check DevTools console in the Tauri window for invoke errors (permissions are `core:default` for custom commands registered on the app).

## Common issues & recovery

| Issue | Recovery |
| --- | --- |
| `rustc` / `cargo` not found | Add `%USERPROFILE%\.cargo\bin` to PATH; restart terminal |
| `link.exe` / MSVC errors | Reinstall C++ Build Tools with **Desktop development with C++** |
| Port 1420 in use | Stop other Vite/PRISM dev servers; or change Vite port + `devUrl` in `tauri.conf.json` |
| Blank window | Install WebView2 Evergreen runtime |
| `icon.ico` RC2175 | Regenerate icons with `npx tauri icon` (see above) |
| Slow first compile | Normal; subsequent `tauri dev` is incremental |
| Accidentally using browser-only dev | `npm run dev` alone has **mock FS** (`localStorage`); use `npm run tauri dev` for real disk |

## Commands quick reference

```powershell
# Dev (native) — primary
npm run tauri dev

# Frontend only (browser, mock FS)
npm run dev

# Typecheck + production bundle (frontend)
npm run build

# Regenerate window/taskbar icons
npx tauri icon .\src-tauri\icons\icon.png -o .\src-tauri\icons
```

## Architecture impact

**Zero** — presentation and bring-up only; no new managers, stores, or backend APIs. FS access uses existing `WorkspaceManager` + existing Tauri commands in `lib.rs`.
