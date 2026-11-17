/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of workers/api, e.g. https://gigsync-api.example.workers.dev. Set at build time. */
  readonly VITE_API_BASE?: string;
  /** The web app's public address, e.g. https://gigsync.app: what a personal QR's link opens. Set at build time. */
  readonly VITE_APP_URL?: string;
  /** Dev builds only: an Ollama model on this computer (e.g. gemma3:1b) to use instead of lite mode. */
  readonly VITE_OLLAMA_MODEL?: string;
  /**
   * The folder GigSync's model host serves the phone's reader from (ADR 0065), e.g.
   * https://models.gigsync.network/reader/v3: its `labels.json` and `onnx/model_quantized.onnx`. Set at build time;
   * a build without it has no reader.
   */
  readonly VITE_READER_URL?: string;
  /**
   * The Firebase web app's config, for real SMS sign-in codes through Firebase phone sign-in (Firebase console →
   * Project settings → Your apps). Set at build time; without all four, sign-in uses the API's dev code (DEV_OTP).
   */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}
