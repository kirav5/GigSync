import { type ModelSpec, SHADER_F16, Variant } from "./catalog.js";
import { Unsupported } from "./definitions.js";

/**
 * Whether this device can run a model, from facts the browser gives (facts.ts gathers them). Pure, so each rule is
 * tested on its own. The GPU limits are the ones WebLLM itself demands when it opens the device (its
 * `detectGPUDevice`): asking first lets the app say "this phone can't" instead of failing half-way into a download.
 */

const MB = 1024 * 1024;
const KB = 1024;
/** WebLLM falls back to 256 MB buffers and refuses below that. */
export const MIN_BUFFER_BYTES = 256 * MB;
/** WebLLM's floor for one storage buffer binding; no Qwen2.5 build asks for more. */
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

/** The GPU can hold WebLLM's buffers and bind enough of them at once. */
function gpuFits(limits: GpuLimits): boolean {
  return (
    limits.maxBufferSize >= MIN_BUFFER_BYTES &&
    limits.maxStorageBufferBindingSize >= MIN_STORAGE_BINDING_BYTES &&
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
  if (!gpuFits(facts.gpu.limits)) return { ok: false, reason: Unsupported.gpuLimits };
  if (facts.memoryGb !== undefined && facts.memoryGb < spec.minMemoryGb) {
    return { ok: false, reason: Unsupported.lowMemory };
  }
  if (facts.freeStorageMb !== undefined && facts.freeStorageMb < spec.downloadMb + STORAGE_MARGIN_MB) {
    return { ok: false, reason: Unsupported.lowStorage };
  }
  return { ok: true, variant: facts.gpu.features.has(SHADER_F16) ? Variant.f16 : Variant.f32 };
}
