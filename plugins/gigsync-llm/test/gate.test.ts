import { describe, expect, it } from "vitest";
import { MODELS, SHADER_F16, Variant } from "../src/catalog.js";
import { ModelSize, Unsupported } from "../src/definitions.js";
import {
  type DeviceFacts,
  type GpuLimits,
  judge,
  MIN_BUFFER_BYTES,
  MIN_STORAGE_BINDING_BYTES,
  MIN_STORAGE_BUFFERS_PER_STAGE,
  MIN_WORKGROUP_STORAGE_BYTES,
  STORAGE_MARGIN_MB,
} from "../src/gate.js";

/** Whether a phone can run the model (LLD §9.1): one test per reason, and the build each GPU gets. */

const small = MODELS[ModelSize.small];
const large = MODELS[ModelSize.large];
const LIMITS: GpuLimits = {
  maxBufferSize: MIN_BUFFER_BYTES,
  maxStorageBufferBindingSize: MIN_STORAGE_BINDING_BYTES,
  maxComputeWorkgroupStorageSize: MIN_WORKGROUP_STORAGE_BYTES,
  maxStorageBuffersPerShaderStage: MIN_STORAGE_BUFFERS_PER_STAGE,
};
const features = (...names: string[]) => new Set(names);
/** A mid-range Android phone in Chrome: WebGPU with f16, 4 GB reported, room to spare. */
const phone: DeviceFacts = {
  browser: true,
  gpu: { limits: LIMITS, features: features(SHADER_F16) },
  memoryGb: 4,
  freeStorageMb: 4000,
};

describe("the capability gate", () => {
  it("lets a capable phone run the small model, in the f16 build when the GPU has shader-f16", () => {
    expect(judge(phone, small)).toEqual({ ok: true, variant: Variant.f16 });
    expect(judge({ ...phone, gpu: { limits: LIMITS, features: features() } }, small)).toEqual({
      ok: true,
      variant: Variant.f32,
    });
  });

  it("refuses a browser without Workers or the Cache API", () => {
    expect(judge({ ...phone, browser: false }, small)).toEqual({ ok: false, reason: Unsupported.browser });
  });

  it("refuses without WebGPU or an adapter", () => {
    expect(judge({ ...phone, gpu: undefined }, small)).toEqual({ ok: false, reason: Unsupported.noWebGpu });
  });

  it("refuses a GPU below any of WebLLM's limits", () => {
    for (const key of Object.keys(LIMITS) as (keyof GpuLimits)[]) {
      const limits = { ...LIMITS, [key]: LIMITS[key] - 1 };
      expect(judge({ ...phone, gpu: { limits, features: features() } }, small), key).toEqual({
        ok: false,
        reason: Unsupported.gpuLimits,
      });
    }
  });

  it("refuses too little reported memory, and allows memory the browser does not report (iPhone)", () => {
    expect(judge({ ...phone, memoryGb: 2 }, small)).toEqual({ ok: false, reason: Unsupported.lowMemory });
    const { memoryGb: _, ...iphone } = phone;
    expect(judge(iphone, small).ok).toBe(true);
  });

  it("refuses when storage cannot hold the model and the margin, and allows storage it cannot measure", () => {
    const tight = small.downloadMb + STORAGE_MARGIN_MB;
    expect(judge({ ...phone, freeStorageMb: tight }, small).ok).toBe(true);
    expect(judge({ ...phone, freeStorageMb: tight - 1 }, small)).toEqual({ ok: false, reason: Unsupported.lowStorage });
    const { freeStorageMb: _, ...unmeasured } = phone;
    expect(judge(unmeasured, small).ok).toBe(true);
  });

  it("asks more of the 1.5B model: an 8 GB phone and room for 900 MB", () => {
    expect(judge(phone, large)).toEqual({ ok: false, reason: Unsupported.lowMemory });
    expect(judge({ ...phone, memoryGb: 8 }, large).ok).toBe(true);
    expect(judge({ ...phone, memoryGb: 8, freeStorageMb: 1000 }, large)).toEqual({
      ok: false,
      reason: Unsupported.lowStorage,
    });
  });

  it("checks in order: browser, WebGPU, GPU limits, memory, storage", () => {
    const worst: DeviceFacts = { browser: false, gpu: undefined, memoryGb: 1, freeStorageMb: 0 };
    expect(judge(worst, small)).toEqual({ ok: false, reason: Unsupported.browser });
    expect(judge({ ...worst, browser: true }, small)).toEqual({ ok: false, reason: Unsupported.noWebGpu });
  });
});
