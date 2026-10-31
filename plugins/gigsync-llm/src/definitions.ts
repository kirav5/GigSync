import type { PluginListenerHandle } from "@capacitor/core";

/**
 * Which model the web engine runs (LLD §9.1): `small`, Qwen3.5-0.8B, for any phone that can run one; `large`,
 * Qwen3.5-2B, for a phone that says it has 8 GB and whose GPU can bind its embeddings. Left out, the engine picks.
 */
export const ModelSize = { small: "small", large: "large" } as const;
export type ModelSize = (typeof ModelSize)[keyof typeof ModelSize];

/** Where the device's model stands. Engines that only say `available` (the native stubs) leave it out. */
export const ModelState = {
  available: "available",
  downloadable: "downloadable",
  downloading: "downloading",
  unavailable: "unavailable",
} as const;
export type ModelState = (typeof ModelState)[keyof typeof ModelState];

/** Why this device cannot run the model at all; the app then stays in lite mode and says why in Settings. */
export const Unsupported = {
  /** No `navigator.gpu`, or the browser offers no GPU adapter. */
  noWebGpu: "no_webgpu",
  /** The GPU's buffers are smaller than the model's tensors need. */
  gpuLimits: "gpu_limits",
  /** The browser reports less memory than the model needs. */
  lowMemory: "low_memory",
  /** Too little room in the browser's storage for the model and a margin. */
  lowStorage: "low_storage",
  /** No Web Workers or Cache API (an old browser, or a page not served over HTTPS). */
  browser: "browser",
} as const;
export type Unsupported = (typeof Unsupported)[keyof typeof Unsupported];

/** Which model, and from where; every call takes them, so the plugin keeps no settings of its own. */
export interface ModelOptions {
  /** Left out: the model already on the phone, else the largest this device says it can hold (gate.ts `recommend`). */
  size?: ModelSize;
  /** Where the model files are served from instead of WebLLM's default (Hugging Face); LLD §9.1 has the layout. */
  baseUrl?: string;
}

export interface GenerateOptions extends ModelOptions {
  prompt: string;
  maxTokens?: number;
  /** 0 for the same answer to the same prompt. */
  temperature?: number;
  /** Ask for one JSON object (the router's reply); the engine constrains its output to JSON. */
  json?: boolean;
  /** With `json`, the JSON Schema the object must fit; WebLLM's grammar then holds the output to it. */
  schema?: Readonly<Record<string, unknown>>;
}

export interface GenerateResult {
  /** False when no model is loaded on this device; `text` is then empty and the agent runs in lite mode. */
  available: boolean;
  text: string;
  /** Which engine answered: "webllm" (the web), "litert" (Android), "foundation-models" (Apple), "none". */
  engine: string;
  /** How long the answer itself took, not counting loading the model into memory first. */
  elapsedMs?: number;
}

/** The model an engine runs or would download. */
export interface ModelInfo {
  /** The engine's own id, e.g. WebLLM's "Qwen3.5-0.8B-q4f16_1-MLC". */
  id: string;
  /** As people read it: "Qwen3.5-0.8B". */
  name: string;
  size: ModelSize;
  /** What the download costs in data, rounded up. */
  downloadMb: number;
}

export interface ModelStatus {
  available: boolean;
  engine: string;
  /** Free RAM in MB as the OS reports it, so the app can decide whether to load a model at all. */
  freeMemoryMb?: number;
  state?: ModelState;
  /** 0–1 while downloading. */
  progress?: number;
  /** While downloading: how much of `model.downloadMb` has arrived. */
  downloadedMb?: number;
  /** Set when `state` is unavailable. */
  reason?: Unsupported;
  model?: ModelInfo;
}

/** The event `prepare()` sends with each step of a download. */
export const PROGRESS_EVENT = "modelProgress";

export interface GigSyncLLMPlugin {
  status(options?: ModelOptions): Promise<ModelStatus>;
  generate(options: GenerateOptions): Promise<GenerateResult>;
  /**
   * Downloads the model and loads it, sending PROGRESS_EVENT on the way; resolves when it is ready or the download
   * stopped (then `state` is downloadable again, and a second call carries on from the files already fetched).
   * Call only after the owner agreed to the download.
   */
  prepare(options?: ModelOptions): Promise<ModelStatus>;
  /** Deletes the downloaded model from this device. */
  remove(options?: ModelOptions): Promise<ModelStatus>;
  addListener(event: typeof PROGRESS_EVENT, listener: (status: ModelStatus) => void): Promise<PluginListenerHandle>;
}
