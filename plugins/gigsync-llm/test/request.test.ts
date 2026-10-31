import type { AppConfig, ModelRecord } from "@mlc-ai/web-llm";
import { describe, expect, it } from "vitest";
import { MODELS } from "../src/catalog.js";
import { ModelSize } from "../src/definitions.js";
import { appConfigFor, completionRequest } from "../src/request.js";

/** What the web engine hands WebLLM: the request for one prompt, and the app config with our models. */

const PROMPT = "Sort one chat message";

describe("the completion request", () => {
  it("passes the length, the temperature and JSON when asked", () => {
    expect(completionRequest({ prompt: PROMPT, maxTokens: 120, temperature: 0, json: true })).toEqual({
      messages: [{ role: "user", content: PROMPT }],
      stream: false,
      max_tokens: 120,
      temperature: 0,
      response_format: { type: "json_object", schema: '{"type":"object"}' },
    });
  });

  it("hands WebLLM the caller's JSON Schema, and tells a thinking model not to", () => {
    const schema = { type: "object", properties: { intent: { type: "string", enum: ["chat"] } }, required: ["intent"] };
    expect(completionRequest({ prompt: PROMPT, json: true, schema }, true)).toMatchObject({
      response_format: { type: "json_object", schema: JSON.stringify(schema) },
      extra_body: { enable_thinking: false },
    });
  });

  it("leaves out what was not asked for, with the default length", () => {
    const request = completionRequest({ prompt: PROMPT });
    expect(request).toEqual({ messages: [{ role: "user", content: PROMPT }], stream: false, max_tokens: 256 });
    expect("temperature" in request || "response_format" in request).toBe(false);
  });
});

const record = (model_id: string): ModelRecord => ({
  model: `https://huggingface.co/mlc-ai/${model_id}`,
  model_id,
  model_lib: `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_86/base/${model_id}-webgpu.wasm`,
});
const SMALL_F16 = MODELS[ModelSize.small].ids.f16;
const prebuilt: AppConfig = { model_list: [record(SMALL_F16), record("Llama-3.2-1B-Instruct-q4f16_1-MLC")] };

describe("the app config", () => {
  it("keeps only our models, from WebLLM's own hosting, in the Cache API", () => {
    expect(appConfigFor(prebuilt)).toEqual({ model_list: [record(SMALL_F16)], cacheBackend: "cache" });
  });

  it("serves every file from the base URL when one is set (Cloudflare R2 later)", () => {
    for (const base of ["https://models.gigsync.network", "https://models.gigsync.network/"]) {
      expect(appConfigFor(prebuilt, base).model_list).toEqual([
        {
          model_id: SMALL_F16,
          model: `https://models.gigsync.network/${SMALL_F16}/`,
          model_lib: `https://models.gigsync.network/libs/${SMALL_F16}-webgpu.wasm`,
        },
      ]);
    }
  });
});
