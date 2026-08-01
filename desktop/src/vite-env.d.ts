/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CODE_OSS_URL?: string;
  readonly VITE_CODE_OSS_WORKBENCH_URL?: string;
  readonly VITE_EDITOR_HOST?: string;
  readonly VITE_GIT_COMMIT?: string;
  /** When set, credential/OAuth submit actions enable. Unset = designed UI, submits disabled. */
  readonly VITE_AUTH_BACKEND_URL?: string;
  /** Ollama HTTP API base (default probes 127.0.0.1:11434 and :11435). */
  readonly VITE_OLLAMA_BASE_URL?: string;
  /** PRISM FastAPI base (default http://127.0.0.1:8000/api/v1). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
