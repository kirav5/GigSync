import type { ChatCompletionRequestNonStreaming } from "@mlc-ai/web-llm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODELS, SHADER_F16 } from "../src/catalog.js";
import { ModelSize, ModelState, type ModelStatus, PROGRESS_EVENT, Unsupported } from "../src/definitions.js";
import type { Engine } from "../src/engine.js";
import { MIN_BUFFER_BYTES, MIN_STORAGE_BINDING_BYTES } from "../src/gate.js";
import type { LoadReport } from "../src/progress.js";
import type { GigSyncLLMWeb } from "../src/web.js";

/** The web engine end to end, with WebLLM replaced by a fake and the browser's APIs stubbed. */

const ID = MODELS[ModelSize.small].ids.f16;
const LARGE_ID = MODELS[ModelSize.large].ids.f16;
const ADAPTER = {
  limits: {
    maxBufferSize: MIN_BUFFER_BYTES,
    maxStorageBufferBindingSize: MIN_STORAGE_BINDING_BYTES,
    maxComputeWorkgroupStorageSize: 32 * 1024,
    maxStorageBuffersPerShaderStage: 10,
  },
  features: new Set([SHADER_F16]),
};
const GB = 1024 ** 3;
const BIG_ADAPTER = {
  ...ADAPTER,
  limits: { ...ADAPTER.limits, maxBufferSize: GB, maxStorageBufferBindingSize: GB },
};

class FakeEngine implements Engine {
  loaded: string | undefined;
  inCache = new Set<string>();
  requests: ChatCompletionRequestNonStreaming[] = [];
  loads = 0;
  failLoad = false;
  async load(id: string, onProgress: (r: LoadReport) => void) {
    this.loads++;
    onProgress({ progress: 0, text: "Start to fetch params" });
    onProgress({ progress: 0.5, text: "Fetching param cache[4/8]: 140MB fetched." });
    if (this.failLoad) throw new Error("network");
    onProgress({ progress: 1, text: "Finish loading on WebGPU - test" });
    this.inCache.add(id);
    this.loaded = id;
  }
  async cached(id: string) {
    return this.inCache.has(id);
  }
  async complete(request: ChatCompletionRequestNonStreaming) {
    this.requests.push(request);
    return '{"intent":"chat"}';
  }
  async remove(id: string) {
    this.inCache.delete(id);
    if (this.loaded === id) this.loaded = undefined;
  }
}

function browser(adapter: object | null, deviceMemory: number) {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  });
  vi.stubGlobal("navigator", {
    gpu: { requestAdapter: async () => adapter },
    deviceMemory,
    storage: { estimate: async () => ({ quota: 10 * GB, usage: 0 }), persist: async () => true },
  });
  vi.stubGlobal("caches", {});
  vi.stubGlobal("Worker", class {});
}

let engine: FakeEngine;
beforeEach(() => {
  engine = new FakeEngine();
});
afterEach(() => vi.unstubAllGlobals());

/** A fresh plugin in a fresh module graph, since facts.ts asks for the adapter once per page. */
async function plugin(adapter: object | null = ADAPTER, memoryGb = 4): Promise<GigSyncLLMWeb> {
  vi.resetModules();
  browser(adapter, memoryGb);
  const { GigSyncLLMWeb: Web } = await import("../src/web.js");
  return new Web(() => engine);
}

describe("the web engine", () => {
  it("offers the model on a capable phone and says why not on one without WebGPU", async () => {
    expect(await (await plugin()).status()).toMatchObject({ state: ModelState.downloadable, model: { id: ID } });
    expect(await (await plugin(null)).status()).toMatchObject({
      available: false,
      state: ModelState.unavailable,
      reason: Unsupported.noWebGpu,
    });
  });

  it("downloads with progress events, then is ready", async () => {
    const w = await plugin();
    const seen: ModelStatus[] = [];
    await w.addListener(PROGRESS_EVENT, (s) => seen.push(s));
    const done = await w.prepare();
    expect(done).toMatchObject({ available: true, state: ModelState.available });
    expect(seen.map((s) => s.progress)).toEqual([0, 0, 0.5, undefined, undefined]);
    expect(await w.status()).toMatchObject({ available: true });
  });

  it("an interrupted download is downloadable again, and the next prepare carries on", async () => {
    const w = await plugin();
    engine.failLoad = true;
    expect(await w.prepare()).toMatchObject({ available: false, state: ModelState.downloadable });
    engine.failLoad = false;
    expect(await w.prepare()).toMatchObject({ available: true });
    expect(engine.loads).toBe(2);
  });

  it("generates with the caller's length, temperature and JSON, and says how long it took", async () => {
    const w = await plugin();
    await w.prepare();
    const result = await w.generate({ prompt: "hello", maxTokens: 120, temperature: 0, json: true });
    expect(result).toMatchObject({ available: true, text: '{"intent":"chat"}', engine: "webllm" });
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(engine.requests[0]).toMatchObject({
      max_tokens: 120,
      temperature: 0,
      response_format: { type: "json_object", schema: '{"type":"object"}' },
      // Qwen3.5 answers at once, without its hidden reasoning first.
      extra_body: { enable_thinking: false },
    });
  });

  it("never downloads again behind the owner's back when the browser evicted the model", async () => {
    const w = await plugin();
    await w.prepare();
    engine.loaded = undefined;
    engine.inCache.clear();
    expect(await w.generate({ prompt: "hello" })).toMatchObject({ available: false });
    expect(engine.loads).toBe(1);
    expect(await w.status()).toMatchObject({ state: ModelState.downloadable });
  });

  it("answers nothing before the model is downloaded", async () => {
    expect(await (await plugin()).generate({ prompt: "hello" })).toMatchObject({ available: false, text: "" });
    expect(engine.requests).toEqual([]);
  });

  it("removes the model", async () => {
    const w = await plugin();
    await w.prepare();
    expect(await w.remove()).toMatchObject({ available: false, state: ModelState.downloadable });
    expect(engine.inCache.size).toBe(0);
  });

  it("picks the 2B for an 8 GB phone whose GPU binds its embeddings, unless asked for a size", async () => {
    const w = await plugin(BIG_ADAPTER, 8);
    expect(await w.status()).toMatchObject({ model: { id: LARGE_ID, size: ModelSize.large } });
    expect(await w.status({ size: ModelSize.small })).toMatchObject({ model: { id: ID } });
  });

  it("keeps the model already on the phone rather than offering a bigger one", async () => {
    const w = await plugin(BIG_ADAPTER, 8);
    await w.prepare({ size: ModelSize.small });
    expect(await w.status()).toMatchObject({ available: true, model: { id: ID, size: ModelSize.small } });
  });
});
