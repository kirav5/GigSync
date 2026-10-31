import { type ModelInfo, ModelSize } from "./definitions.js";

/**
 * The models the web engine may run, by WebLLM's ids in `prebuiltAppConfig` (@mlc-ai/web-llm 0.2.86). Each comes in
 * two builds: `f16` needs the GPU's "shader-f16" feature, `f32` runs on any WebGPU; the weights are 4-bit in both.
 * Download sizes are the weights in each repo's tensor cache plus the WebGPU library and tokenizer, rounded up.
 * Both models are Apache-2.0.
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
}

export const MODELS: Readonly<Record<ModelSize, ModelSpec>> = {
  [ModelSize.small]: {
    name: "Qwen2.5-0.5B-Instruct",
    ids: { f16: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-0.5B-Instruct-q4f32_1-MLC" },
    // 278 MB of weights, a 6 MB WebGPU library and a 7 MB tokenizer.
    downloadMb: 300,
    minMemoryGb: 4,
  },
  [ModelSize.large]: {
    name: "Qwen2.5-1.5B-Instruct",
    ids: { f16: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-1.5B-Instruct-q4f32_1-MLC" },
    // 869 MB of weights, plus library and tokenizer. Needs about 1.7 GB of GPU memory, so only 8 GB phones.
    downloadMb: 900,
    minMemoryGb: 8,
  },
};

/** Every id this app may have put in the browser's cache, for removing them all. */
export const ALL_IDS: readonly string[] = Object.values(MODELS).flatMap((m) => Object.values(m.ids));

export const specOf = (size: ModelSize | undefined): ModelSpec => MODELS[size ?? ModelSize.small];

export const infoOf = (spec: ModelSpec, variant: Variant): ModelInfo => ({
  id: spec.ids[variant],
  name: spec.name,
  downloadMb: spec.downloadMb,
});
