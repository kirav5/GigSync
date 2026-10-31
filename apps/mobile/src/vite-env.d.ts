/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of workers/api, e.g. https://gigsync-api.example.workers.dev. Set at build time. */
  readonly VITE_API_BASE?: string;
  /** The web app's public address, e.g. https://gigsync.app: what a personal QR's link opens. Set at build time. */
  readonly VITE_APP_URL?: string;
  /** Dev builds only: an Ollama model on this computer (e.g. gemma3:1b) to use instead of lite mode. */
  readonly VITE_OLLAMA_MODEL?: string;
}
