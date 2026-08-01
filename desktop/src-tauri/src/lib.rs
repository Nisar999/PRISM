use std::fs;
use std::fs::OpenOptions;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[tauri::command]
fn read_file_string(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file_string(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(p, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_dir_all(path: String) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_dir_contents(path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            if let Some(name) = entry.file_name().to_str() {
                files.push(name.to_string());
            }
        }
    }
    Ok(files)
}

#[tauri::command]
fn path_is_directory(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).is_dir())
}

/// Per-user data directory — `%LOCALAPPDATA%\PRISM` (no repo paths).
#[tauri::command]
fn get_data_dir() -> Result<String, String> {
    let dir = data_dir()?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

fn data_dir() -> Result<PathBuf, String> {
    #[cfg(windows)]
    {
        let base = std::env::var("LOCALAPPDATA").map_err(|_| "LOCALAPPDATA missing".to_string())?;
        return Ok(PathBuf::from(base).join("PRISM"));
    }
    #[cfg(not(windows))]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME missing".to_string())?;
        Ok(PathBuf::from(home).join(".prism"))
    }
}

fn port_open(port: u16) -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{port}").parse().unwrap(),
        Duration::from_millis(250),
    )
    .is_ok()
}

/// Directory that contains `PRISM.exe` / `desktop.exe` (install root).
fn install_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    exe.parent().map(|p| p.to_path_buf())
}

/// Self-contained runtime: `<install>/runtime` or `<install>/resources/runtime`.
fn find_runtime_dir() -> Option<PathBuf> {
    let install = install_dir()?;
    let candidates = [
        install.join("runtime"),
        install.join("resources").join("runtime"),
        // Tauri resource unpack sometimes nests under target-specific folders
        install.join("resources"),
    ];
    for c in candidates {
        if c.join("manifest.json").exists()
            || c.join("backend").exists()
            || c.join("code-oss").exists()
        {
            // If we matched install/resources (parent), prefer runtime child
            if c.ends_with("resources") && c.join("runtime").exists() {
                return Some(c.join("runtime"));
            }
            if c.file_name().and_then(|n| n.to_str()) == Some("runtime") {
                return Some(c);
            }
            if c.join("runtime").exists() {
                return Some(c.join("runtime"));
            }
            return Some(c);
        }
    }
    None
}

fn runtime_log_dir() -> PathBuf {
    data_dir()
        .map(|d| d.join("logs"))
        .unwrap_or_else(|_| {
            install_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("logs")
        })
}

fn code_oss_pid_path() -> PathBuf {
    data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("code-oss.pid")
}

fn code_oss_mount_path() -> PathBuf {
    data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("code-oss-mount.txt")
}

fn spawn_detached(mut cmd: Command, log_stem: &str) -> Result<u32, String> {
    let log_dir = runtime_log_dir();
    let _ = fs::create_dir_all(&log_dir);
    let stdout_path = log_dir.join(format!("{log_stem}-stdout.log"));
    let stderr_path = log_dir.join(format!("{log_stem}-stderr.log"));
    let stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&stdout_path)
        .map_err(|e| e.to_string())?;
    let stderr = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&stderr_path)
        .map_err(|e| e.to_string())?;
    cmd.stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let child = cmd.spawn().map_err(|e| e.to_string())?;
    Ok(child.id())
}

fn kill_code_oss_process() {
    if let Ok(pid_str) = fs::read_to_string(code_oss_pid_path()) {
        if let Ok(pid) = pid_str.trim().parse::<u32>() {
            let mut kill = Command::new("taskkill");
            kill.args(["/F", "/T", "/PID", &pid.to_string()])
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            #[cfg(windows)]
            {
                kill.creation_flags(CREATE_NO_WINDOW);
            }
            let _ = kill.status();
        }
    }
    #[cfg(windows)]
    {
        // Orphan listeners from older builds without a pid file.
        let mut ps = Command::new("powershell");
        ps.args([
            "-NoProfile",
            "-Command",
            "Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW);
        let _ = ps.status();
    }
    let _ = fs::remove_file(code_oss_pid_path());
    std::thread::sleep(Duration::from_millis(400));
}

fn start_backend_from_runtime(runtime: &Path) -> String {
    let py = runtime
        .join("backend")
        .join("python")
        .join("Scripts")
        .join("python.exe");
    let cwd = runtime.join("backend");
    if !py.exists() {
        return "missing_backend_python".to_string();
    }
    let mut cmd = Command::new(&py);
    cmd.current_dir(&cwd).args([
        "-m",
        "uvicorn",
        "prism.main:create_app",
        "--factory",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
    ]);
    match spawn_detached(cmd, "backend") {
        Ok(_) => "started".to_string(),
        Err(e) => format!("start_failed:{e}"),
    }
}

fn start_code_oss_from_runtime(runtime: &Path, workspace_folder: Option<&Path>) -> String {
    let node = runtime.join("code-oss").join("node").join("node.exe");
    let script = runtime.join("code-oss").join("launcher").join("start.mjs");
    let cwd = runtime.join("code-oss").join("launcher");
    if !node.exists() || !script.exists() {
        return "missing_code_oss".to_string();
    }
    let mut cmd = Command::new(&node);
    cmd.current_dir(&cwd)
        .arg(&script)
        .env("PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", "1")
        .env("PRISM_CODE_OSS_PORT", "8080")
        // localhost required for {{uuid}}.localhost web-worker extension host URLs
        .env("PRISM_CODE_OSS_HOST", "localhost");
    if let Some(folder) = workspace_folder {
        if folder.is_dir() {
            cmd.env("PRISM_WORKSPACE_FOLDER", folder);
            let _ = fs::write(
                code_oss_mount_path(),
                folder.to_string_lossy().as_bytes(),
            );
        }
    }
    match spawn_detached(cmd, "code-oss") {
        Ok(pid) => {
            let _ = fs::create_dir_all(data_dir().unwrap_or_else(|_| PathBuf::from(".")));
            let _ = fs::write(code_oss_pid_path(), pid.to_string());
            "started".to_string()
        }
        Err(e) => format!("start_failed:{e}"),
    }
}

/// Start backend (:8000) and Code-OSS (:8080) from the installed `runtime/` tree.
/// No repository paths. No PowerShell. No PRISM_ROOT.
#[tauri::command]
fn ensure_runtime_services() -> Result<serde_json::Value, String> {
    let mut backend = if port_open(8000) {
        "already_up".to_string()
    } else {
        "unavailable".to_string()
    };
    let mut code_oss = if port_open(8080) {
        "already_up".to_string()
    } else {
        "unavailable".to_string()
    };

    let runtime = find_runtime_dir();
    let runtime_path = runtime
        .as_ref()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();

    if backend == "unavailable" {
        backend = match &runtime {
            Some(r) => start_backend_from_runtime(r),
            None => "runtime_not_found".to_string(),
        };
    }

    if code_oss == "unavailable" {
        // Reuse last mounted folder if present so restart restores Explorer.
        let prior = fs::read_to_string(code_oss_mount_path())
            .ok()
            .map(PathBuf::from)
            .filter(|p| p.is_dir());
        code_oss = match &runtime {
            Some(r) => start_code_oss_from_runtime(r, prior.as_deref()),
            None => "runtime_not_found".to_string(),
        };
    }

    // Give services a brief moment to bind (best-effort).
    if backend == "started" || code_oss == "started" {
        std::thread::sleep(Duration::from_millis(1500));
    }

    let payload = serde_json::json!({
        "backend": backend,
        "codeOss": code_oss,
        "runtimeDir": runtime_path,
        "installDir": install_dir().map(|p| p.to_string_lossy().into_owned()),
        "dataDir": data_dir().ok().map(|p| p.to_string_lossy().into_owned()),
    });

    // Diagnostic breadcrumb for clean-machine validation.
    if let Ok(dir) = data_dir() {
        let _ = fs::create_dir_all(&dir);
        let _ = fs::write(dir.join("runtime-ensure.json"), payload.to_string());
    }

    Ok(payload)
}

/// Mount a local folder into the editing engine (vscode-test-web FS provider).
/// Restarts the sidecar with PRISM_WORKSPACE_FOLDER so Explorer can list/edit files.
/// Returns the workbench folder URI to open (`vscode-test-web://mount/`).
#[tauri::command]
fn mount_editor_workspace(path: String) -> Result<serde_json::Value, String> {
    let folder = PathBuf::from(path.trim());
    if !folder.is_dir() {
        return Err("Workspace folder does not exist".into());
    }

    let current = fs::read_to_string(code_oss_mount_path()).unwrap_or_default();
    let already_mounted =
        port_open(8080) && PathBuf::from(current.trim()) == folder && !current.trim().is_empty();

    if !already_mounted {
        kill_code_oss_process();
        let runtime = find_runtime_dir().ok_or_else(|| "runtime_not_found".to_string())?;
        let status = start_code_oss_from_runtime(&runtime, Some(&folder));
        if !status.starts_with("started") {
            return Err(format!("editor_start_failed:{status}"));
        }
        let deadline = std::time::Instant::now() + Duration::from_secs(45);
        while std::time::Instant::now() < deadline {
            if port_open(8080) {
                break;
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        if !port_open(8080) {
            return Err("editor_timeout".into());
        }
        // Extra settle for ESM workbench + FS provider.
        std::thread::sleep(Duration::from_millis(800));
    }

    Ok(serde_json::json!({
        "ok": true,
        "folderUri": "vscode-test-web://mount/",
        "path": folder.to_string_lossy(),
        "remounted": !already_mounted,
    }))
}

#[cfg(test)]
mod fs_command_tests {
    use super::*;
    use std::fs;

    #[test]
    fn create_read_write_delete_roundtrip() {
        let root = std::env::temp_dir().join("prism_r3_fs_test");
        let _ = fs::remove_dir_all(&root);
        create_dir_all(root.to_string_lossy().into_owned()).expect("create_dir_all");

        let file = root.join("project.json");
        let path = file.to_string_lossy().into_owned();
        write_file_string(path.clone(), r#"{"id":"t"}"#.into()).expect("write");
        let read = read_file_string(path.clone()).expect("read");
        assert!(read.contains("\"id\":\"t\""));

        fs::remove_file(&file).expect("delete file");
        assert!(!file.exists());
        let _ = fs::remove_dir_all(&root);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_file_string,
            write_file_string,
            create_dir_all,
            read_dir_contents,
            path_is_directory,
            get_data_dir,
            ensure_runtime_services,
            mount_editor_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
