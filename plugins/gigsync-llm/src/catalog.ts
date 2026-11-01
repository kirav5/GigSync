import type { ModelInfo } from "./definitions.js";

/**
 * The model the web engine runs, by WebLLM's ids in `prebuiltAppConfig` (@mlc-ai/web-llm 0.2.86): Qwen3.5-2B
 * (Apache-2.0), in two builds: `f16` needs the GPU's "shader-f16" feature, `f32` runs on any WebGPU; the weights are
 * 4-bit in both. One model, not tiers: on the intent eval the 0.8B added nothing to the embedding router (ADR 0042)
 * that every phone can carry, while the 2B added 16 points (docs/gigsync/model-comparison.md).
 */

export const Variant = { f16: "f16", f32: "f32" } as const;
export type Variant = (typeof Variant)[keyof typeof Variant];

/** The GPU feature the f16 builds need. */
export const SHADER_F16 = "shader-f16";

export interface ModelSpec {
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

export const MODEL: ModelSpec = {
  name: "Qwen3.5-2B",
  ids: { f16: "Qwen3.5-2B-q4f16_1-MLC", f32: "Qwen3.5-2B-q4f32_1-MLC" },
  // 1,032 MB in 31 shards, plus library and tokenizer; about 2.2 GB of GPU memory, so only phones that say 8 GB.
  downloadMb: 1050,
  minMemoryGb: 8,
  // embed_tokens.q_weight: 248,320 × 256 uint32, past WebGPU's promised 128 MiB.
  largestTensorBytes: 254_279_680,
  thinks: true,
};

/** Every id this app may have put in the browser's cache, for removing them all. */
export const ALL_IDS: readonly string[] = Object.values(MODEL.ids);

export const infoOf = (spec: ModelSpec, variant: Variant): ModelInfo => ({
  id: spec.ids[variant],
  name: spec.name,
  downloadMb: spec.downloadMb,
});
