/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of workers/api, e.g. https://collab-api.example.workers.dev. Set at build time. */
  readonly VITE_API_BASE?: string;
}
