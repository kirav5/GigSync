import { type ModelInfo, ModelSize } from "./definitions.js";

/**
 * The models the web engine may run, by WebLLM's ids in `prebuiltAppConfig` (@mlc-ai/web-llm 0.2.86). Each comes in
 * two builds: `f16` needs the GPU's "shader-f16" feature, `f32` runs on any WebGPU; the weights are 4-bit in both.
 * Download sizes are the weights in each repo's tensor cache plus the WebGPU library and tokenizer, rounded up.
 * Both models are Qwen3.5 (Apache-2.0), chosen over Qwen2.5 by the intent eval (docs/gigsync/model-comparison.md).
 */

export const Variant = { f16: "f16", f32: "f32" } as const;
export type Variant = (typeof Variant)[keyof typeof Variant];

/** The GPU feature the f16 builds need. */
export const SHADER_F16 = "shader-f16";

export interface ModelSpec {
  size: ModelSize;
  name: string;
  ids: Readonly<Record<Variant, string>>;
  downloadMb: number;
  /** `navigator.deviceMemory` below this (where a browser reports it) is too little; it reports 0.25 to 8, rounded. */
  minMemoryGb: number;
  /**
   * The model's largest tensor (its word embeddings) in bytes: the GPU must bind a buffer this big. WebGPU promises
   * only 128 MiB per binding, so a model past that runs only where the adapter offers more.
   */
  largestTensorBytes: number;
  /** Qwen3.5 reasons in hidden "thinking" before answering unless told not to; the engine always tells it not to. */
  thinks: boolean;
}

export const MODELS: Readonly<Record<ModelSize, ModelSpec>> = {
  [ModelSize.small]: {
    size: ModelSize.small,
    name: "Qwen3.5-0.8B",
    ids: { f16: "Qwen3.5-0.8B-q4f16_1-MLC", f32: "Qwen3.5-0.8B-q4f32_1-MLC" },
    // 426 MB in the repo (weights, WebGPU library not included) in 11 shards; WebLLM asks for about 1.6 GB of GPU memory.
    downloadMb: 440,
    minMemoryGb: 4,
    // embed_tokens.q_weight: 248,320 × 128 uint32.
    largestTensorBytes: 127_139_840,
    thinks: true,
  },
  [ModelSize.large]: {
    size: ModelSize.large,
    name: "Qwen3.5-2B",
    ids: { f16: "Qwen3.5-2B-q4f16_1-MLC", f32: "Qwen3.5-2B-q4f32_1-MLC" },
    // 1,032 MB in 31 shards; about 2.2 GB of GPU memory, so only phones that say they have 8 GB.
    downloadMb: 1050,
    minMemoryGb: 8,
    // embed_tokens.q_weight: 248,320 × 256 uint32, past WebGPU's promised 128 MiB.
    largestTensorBytes: 254_279_680,
    thinks: true,
  },
};

/** Largest first: the order Auto tries them in. */
export const BY_SIZE_DOWN: readonly ModelSpec[] = [MODELS[ModelSize.large], MODELS[ModelSize.small]];

/** Every id this app may have put in the browser's cache, for removing them all. */
export const ALL_IDS: readonly string[] = Object.values(MODELS).flatMap((m) => Object.values(m.ids));

/** The model a WebLLM id belongs to. */
export const specOfId = (id: string | undefined): ModelSpec | undefined =>
  BY_SIZE_DOWN.find((spec) => Object.values(spec.ids).includes(id ?? ""));

export const infoOf = (spec: ModelSpec, variant: Variant): ModelInfo => ({
  id: spec.ids[variant],
  name: spec.name,
  size: spec.size,
  downloadMb: spec.downloadMb,
});
