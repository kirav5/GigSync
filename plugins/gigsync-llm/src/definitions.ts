export interface GenerateOptions {
  prompt: string;
  maxTokens?: number;
}

export interface GenerateResult {
  /** False when no model is loaded on this device; `text` is then empty and the agent runs in lite mode. */
  available: boolean;
  text: string;
  /** Which engine answered: "foundation-models" (Apple), "litert" (Android), "chrome-built-in" (desktop Chrome), "none". */
  engine: string;
}

/** A model the engine could fetch: Chrome downloads its built-in model once per profile, after a user tap. */
export const ModelDownload = { downloadable: "downloadable", downloading: "downloading" } as const;
export type ModelDownload = (typeof ModelDownload)[keyof typeof ModelDownload];

export interface ModelStatus {
  available: boolean;
  engine: string;
  /** Free RAM in MB as the OS reports it, so the app can decide whether to load a model at all. */
  freeMemoryMb?: number;
  /** Set when a model exists for this engine but is not on the device yet. */
  download?: ModelDownload;
}

export interface GigSyncLLMPlugin {
  status(): Promise<ModelStatus>;
  generate(options: GenerateOptions): Promise<GenerateResult>;
  /** Fetches the engine's model if it has to be downloaded first. Call only from a user's tap. */
  prepare(): Promise<ModelStatus>;
}
