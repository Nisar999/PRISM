import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  build: {
    // RC bundle: split heavy vendor from app chrome for faster reload/cache.
    target: "esnext",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          icons: ["lucide-react"],
        },
      },
    },
  },
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    // Bind IPv4 loopback so http://127.0.0.1:1420 works on Windows
    // (host:false can end up IPv6-only via localhost → ::1).
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    // Same-origin proxy to unmodified Code-OSS web (scripts/code-oss-web.ps1 → :8080).
    // Nested workbench iframe uses /__code-oss/ so Explorer/Tabs/Terminal/Problems/Search
    // load from upstream without launching a separate application.
    proxy: {
      "/__code-oss": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        ws: true,
        rewrite: (p: string) => p.replace(/^\/__code-oss/, "") || "/",
      },
    },
  },
}));
