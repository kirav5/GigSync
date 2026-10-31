import { BY_SIZE_DOWN, type ModelSpec, SHADER_F16, Variant } from "./catalog.js";
import { ModelSize, Unsupported } from "./definitions.js";

/**
 * Whether this device can run a model, from facts the browser gives (facts.ts gathers them). Pure, so each rule is
 * tested on its own. The GPU limits are the ones WebLLM itself demands when it opens the device (its
 * `detectGPUDevice`): asking first lets the app say "this phone can't" instead of failing half-way into a download.
 */

const MB = 1024 * 1024;
const KB = 1024;
/** WebLLM falls back to 256 MB buffers and refuses below that. */
export const MIN_BUFFER_BYTES = 256 * MB;
/** WebLLM's floor for one storage buffer binding; a model whose largest tensor is bigger needs that much instead. */
export const MIN_STORAGE_BINDING_BYTES = 128 * MB;
export const MIN_WORKGROUP_STORAGE_BYTES = 32 * KB;
export const MIN_STORAGE_BUFFERS_PER_STAGE = 10;
/** Room left over after the model, so the download never fills the browser's storage to the brim. */
export const STORAGE_MARGIN_MB = 200;

/** The adapter limits WebLLM reads; a `GPUSupportedLimits` fits. */
export interface GpuLimits {
  maxBufferSize: number;
  maxStorageBufferBindingSize: number;
  maxComputeWorkgroupStorageSize: number;
  maxStorageBuffersPerShaderStage: number;
}

export interface GpuFacts {
  limits: GpuLimits;
  features: { has(feature: string): boolean };
}

export interface DeviceFacts {
  /** Web Workers and the Cache API both exist: WebLLM runs in one and keeps its files in the other. */
  browser: boolean;
  /** The adapter `navigator.gpu.requestAdapter()` gave; undefined when there is no WebGPU or no adapter. */
  gpu: GpuFacts | undefined;
  /** `navigator.deviceMemory`; undefined where the browser does not say (Safari, Firefox). */
  memoryGb?: number;
  /** Quota minus usage from `navigator.storage.estimate()`; undefined when it cannot tell. */
  freeStorageMb?: number;
}

export type Verdict = { ok: true; variant: Variant } | { ok: false; reason: Unsupported };

/** The GPU can hold WebLLM's buffers, bind the model's largest tensor, and bind enough buffers at once. */
function gpuFits(limits: GpuLimits, spec: ModelSpec): boolean {
  const binding = Math.max(MIN_STORAGE_BINDING_BYTES, spec.largestTensorBytes);
  return (
    limits.maxBufferSize >= Math.max(MIN_BUFFER_BYTES, binding) &&
    limits.maxStorageBufferBindingSize >= binding &&
    limits.maxComputeWorkgroupStorageSize >= MIN_WORKGROUP_STORAGE_BYTES &&
    limits.maxStorageBuffersPerShaderStage >= MIN_STORAGE_BUFFERS_PER_STAGE
  );
}

/**
 * Can this device run `spec`, and which build? Unknown memory or storage counts as enough: an iPhone never says how
 * much memory it has, and a load that fails there falls back to lite mode like any other failure.
 */
export function judge(facts: DeviceFacts, spec: ModelSpec): Verdict {
  if (!facts.browser) return { ok: false, reason: Unsupported.browser };
  if (!facts.gpu) return { ok: false, reason: Unsupported.noWebGpu };
  if (!gpuFits(facts.gpu.limits, spec)) return { ok: false, reason: Unsupported.gpuLimits };
  if (facts.memoryGb !== undefined && facts.memoryGb < spec.minMemoryGb) {
    return { ok: false, reason: Unsupported.lowMemory };
  }
  if (facts.freeStorageMb !== undefined && facts.freeStorageMb < spec.downloadMb + STORAGE_MARGIN_MB) {
    return { ok: false, reason: Unsupported.lowStorage };
  }
  return { ok: true, variant: facts.gpu.features.has(SHADER_F16) ? Variant.f16 : Variant.f32 };
}

/**
 * The model Auto picks for this device: the largest it passes the gate for with its memory confirmed. A browser that
 * does not report memory (Safari, so every iPhone) gets the small one: iPhones from 4 to 8 GB look the same, and a
 * model too big for the phone is lost to a crash rather than a clear "can't". Chrome rounds what it reports to a power
 * of two and stops at 8, so a 6 GB phone says 4 and gets the small model too.
 */
export function recommend(facts: DeviceFacts): ModelSize {
  const fits = (spec: ModelSpec) =>
    facts.memoryGb !== undefined && facts.memoryGb >= spec.minMemoryGb && judge(facts, spec).ok;
  return BY_SIZE_DOWN.find(fits)?.size ?? ModelSize.small;
}
