import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeStateLayer } from "@/lib/store";
import { registerDefaultCommands } from "@/lib/defaultCommands";
import { authService } from "@/lib/auth";
import { providerManager } from "@/lib/providers";
import { millyEngine } from "@/lib/milly";
import { settingsManager } from "@/lib/settings";
import { pluginManager } from "@/lib/plugins";
import { memoryManager } from "@/lib/memory";
import { layoutManager } from "@/lib/layout";
import {
  hydrateOpenPanesFromSettings,
  hydrateShellFromSettings,
  restoreLastWorkspaceIfEnabled,
} from "@/lib/sessionRestore";
import { isNativeDesktop } from "@/lib/nativeFolder";

// Bootstrap the real-time websocket and client stores
initializeStateLayer();

// Bootstrap command surface registry and shortcut bindings
registerDefaultCommands();

async function ensureNativeRuntime(): Promise<void> {
  if (!(await isNativeDesktop())) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<Record<string, string>>("ensure_runtime_services");
    console.info("Runtime services:", result);
    // Brief settle so Open Folder → editor can hit a live Code-OSS host.
    await new Promise((r) => setTimeout(r, 1500));
  } catch (err) {
    console.warn("Runtime service ensure skipped:", err);
  }
}

// Restore encrypted session → settings → providers → restore workspace.
// Workspace is only restored when the user is authenticated; otherwise the
// splash gate will present the login screen.
void authService
  .restoreSession()
  .then(() => settingsManager.bootstrap())
  .then(() => {
    hydrateShellFromSettings();
    hydrateOpenPanesFromSettings();
    return providerManager.bootstrap();
  })
  .then(() => ensureNativeRuntime())
  .then(() => {
    if (authService.isAuthenticated()) return restoreLastWorkspaceIfEnabled();
  })
  .catch((err) => {
    console.warn("Desktop bootstrap warning:", err);
  });

// Ensure default layout panels are registered (Layout Engine mount)
layoutManager.registerPanel({
  id: 'memory',
  title: 'Memory',
  componentType: 'Memory',
  isUnique: true,
});
layoutManager.registerPanel({
  id: 'thoughts',
  title: 'Thoughts',
  componentType: 'Thoughts',
  isUnique: true,
});
layoutManager.registerPanel({
  id: 'execution',
  title: 'Execution',
  componentType: 'Graph',
  isUnique: true,
});
layoutManager.registerPanel({
  id: 'workspace',
  title: 'Workspace',
  componentType: 'Workspace',
  isUnique: true,
});

// Probe backend reachability for memory status (no mock memory)
void memoryManager.probe();

// Start Milly cognitive presence state sync
millyEngine.startSync();

// Bootstrap capability plugins
pluginManager.bootstrap();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
