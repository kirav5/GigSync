import { describe, expect, it } from "vitest";
import { MODEL, SHADER_F16, Variant } from "../src/catalog.js";
import { Unsupported } from "../src/definitions.js";
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

const MIB = 2 ** 20;
/** A GPU exactly at every limit: buffers of 256 MiB and one binding the size of the 2B's embeddings. */
const LIMITS: GpuLimits = {
  maxBufferSize: 256 * MIB,
  maxStorageBufferBindingSize: MODEL.largestTensorBytes,
  maxComputeWorkgroupStorageSize: MIN_WORKGROUP_STORAGE_BYTES,
  maxStorageBuffersPerShaderStage: MIN_STORAGE_BUFFERS_PER_STAGE,
};
const features = (...names: string[]) => new Set(names);
/** An upper mid-range Android phone in Chrome: WebGPU with f16, 8 GB reported, room to spare. */
const phone: DeviceFacts = {
  browser: true,
  gpu: { limits: LIMITS, features: features(SHADER_F16) },
  memoryGb: 8,
  freeStorageMb: 4000,
};

describe("the capability gate", () => {
  it("lets a capable phone run the model, in the f16 build when the GPU has shader-f16", () => {
    expect(judge(phone, MODEL)).toEqual({ ok: true, variant: Variant.f16 });
    expect(judge({ ...phone, gpu: { limits: LIMITS, features: features() } }, MODEL)).toEqual({
      ok: true,
      variant: Variant.f32,
    });
  });

  it("refuses a browser without Workers or the Cache API", () => {
    expect(judge({ ...phone, browser: false }, MODEL)).toEqual({ ok: false, reason: Unsupported.browser });
  });

  it("refuses without WebGPU or an adapter", () => {
    expect(judge({ ...phone, gpu: undefined }, MODEL)).toEqual({ ok: false, reason: Unsupported.noWebGpu });
  });

  it("refuses a GPU below any of WebLLM's limits", () => {
    for (const key of Object.keys(LIMITS) as (keyof GpuLimits)[]) {
      const limits = { ...LIMITS, [key]: LIMITS[key] - 1 };
      expect(judge({ ...phone, gpu: { limits, features: features() } }, MODEL), key).toEqual({
        ok: false,
        reason: Unsupported.gpuLimits,
      });
    }
  });

  it("refuses a GPU that binds only WebGPU's promised 128 MiB: the 2B's embeddings are 242 MiB", () => {
    const promised = {
      ...LIMITS,
      maxBufferSize: MIN_BUFFER_BYTES,
      maxStorageBufferBindingSize: MIN_STORAGE_BINDING_BYTES,
    };
    expect(judge({ ...phone, gpu: { limits: promised, features: features() } }, MODEL)).toEqual({
      ok: false,
      reason: Unsupported.gpuLimits,
    });
  });

  it("refuses a phone that reports under 8 GB (a 6 GB phone reports 4), or reports nothing (every iPhone)", () => {
    expect(judge({ ...phone, memoryGb: 4 }, MODEL)).toEqual({ ok: false, reason: Unsupported.lowMemory });
    const { memoryGb: _, ...iphone } = phone;
    expect(judge(iphone, MODEL)).toEqual({ ok: false, reason: Unsupported.unknownMemory });
  });

  it("refuses when storage cannot hold the model and the margin, and allows storage it cannot measure", () => {
    const tight = MODEL.downloadMb + STORAGE_MARGIN_MB;
    expect(judge({ ...phone, freeStorageMb: tight }, MODEL).ok).toBe(true);
    expect(judge({ ...phone, freeStorageMb: tight - 1 }, MODEL)).toEqual({ ok: false, reason: Unsupported.lowStorage });
    const { freeStorageMb: _, ...unmeasured } = phone;
    expect(judge(unmeasured, MODEL).ok).toBe(true);
  });

  it("checks in order: browser, WebGPU, GPU limits, memory, storage", () => {
    const worst: DeviceFacts = { browser: false, gpu: undefined, memoryGb: 1, freeStorageMb: 0 };
    expect(judge(worst, MODEL)).toEqual({ ok: false, reason: Unsupported.browser });
    expect(judge({ ...worst, browser: true }, MODEL)).toEqual({ ok: false, reason: Unsupported.noWebGpu });
  });
});
