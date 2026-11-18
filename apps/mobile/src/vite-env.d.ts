/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of workers/api, e.g. https://gigsync-api.example.workers.dev. Set at build time. */
  readonly VITE_API_BASE?: string;
  /**
   * The web app's address, e.g. https://staging.gigsync.network/app: what a QR's link opens. Optional at build time:
   * unset, a phone links to https://gigsync.network/app and the web to its own site's /app.
   */
  readonly VITE_APP_URL?: string;
  /** Dev builds only: an Ollama model on this computer (e.g. gemma3:1b) to use instead of lite mode. */
  readonly VITE_OLLAMA_MODEL?: string;
  /**
   * The phone's two models as one bundle on GigSync's model host (ADR 0065, `pnpm models:bundle` and
   * `pnpm models:publish`), for the web: the folder of one version, e.g. https://models.gigsync.network/v6/. Set at
   * build time; a web build without it fetches the embedding model from Hugging Face and has no reader. A native app
   * reads the bundle it came with instead.
   */
  readonly VITE_MODELS_URL?: string;
  /**
   * The Firebase web app's config, for real SMS sign-in codes through Firebase phone sign-in (Firebase console →
   * Project settings → Your apps). Set at build time; without all four, sign-in uses the API's dev code (DEV_OTP).
   */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}
