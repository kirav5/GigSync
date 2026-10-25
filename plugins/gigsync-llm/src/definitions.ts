export interface GenerateOptions {
  prompt: string;
  maxTokens?: number;
}

export interface GenerateResult {
  /** False when no model is loaded on this device; `text` is then empty and the agent runs in lite mode. */
  available: boolean;
  text: string;
  /** Which engine answered: "foundation-models" (Apple), "litert" (Android), "none". */
  engine: string;
}

export interface ModelStatus {
  available: boolean;
  engine: string;
  /** Free RAM in MB as the OS reports it, so the app can decide whether to load a model at all. */
  freeMemoryMb?: number;
}

export interface GigSyncLLMPlugin {
  status(): Promise<ModelStatus>;
  generate(options: GenerateOptions): Promise<GenerateResult>;
}
