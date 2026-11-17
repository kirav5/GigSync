import { createExecutionContext, env } from "cloudflare:test";
import { BEARER_PREFIX, Header } from "@gigsync/core";
import { MODEL_PROMPT_MAX } from "@gigsync/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/index.js";
import { type Person, signIn } from "./people.js";

/** ADR 0052: GigSync's own model, asked through the API with the owner's session; the model is the server's choice. */

const ORIGIN = "https://model.test";
const NAME = "qwen3:30b-a3b-instruct-2507-q4_K_M";
const CONFIGURED = {
  MODEL_ORIGIN: ORIGIN,
  MODEL_NAME: NAME,
  MODEL_ACCESS_ID: "access-id",
  MODEL_ACCESS_SECRET: "access-secret",
};

function ask(as: Person | undefined, body: unknown, more: Record<string, string | undefined> = CONFIGURED) {
  const headers: Record<string, string> = { [Header.contentType]: "application/json" };
  if (as) headers[Header.authorization] = `${BEARER_PREFIX}${as.session.token}`;
  return Promise.resolve(
    app.fetch(
      new Request("http://x/v1/model/generate", { method: "POST", headers, body: JSON.stringify(body) }),
      { ...env, ...more },
      createExecutionContext(),
    ),
  );
}

const SCHEMA = { type: "object", properties: { intent: { type: "string" } } };

afterEach(() => vi.restoreAllMocks());

describe("GigSync's model through the API", () => {
  it("asks the server's model, without reasoning, held to the schema, and returns its answer", async () => {
    const fetched = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ response: ' {"intent":"find"} ' }));
    const res = await ask(await signIn("+919844500001"), {
      prompt: "mujhe kal plumber chahiye",
      json: true,
      schema: SCHEMA,
      max_tokens: 64,
      temperature: 0,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ text: '{"intent":"find"}', usage: { ms: expect.any(Number) } });
    const [url, init] = fetched.mock.calls[0] ?? [];
    expect(String(url)).toBe(`${ORIGIN}/api/generate`);
    const sent = JSON.parse(String(init?.body));
    expect(sent).toMatchObject({ model: NAME, stream: false, think: false, format: SCHEMA, keep_alive: "24h" });
    expect(sent.options).toEqual({ num_predict: 64, temperature: 0 });
    expect(new Headers(init?.headers).get("CF-Access-Client-Id")).toBe("access-id");
  });

  it("returns the model's own counts with the answer, and takes what the prompt is for", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ response: "ok", load_duration: 2_500_000_000, prompt_eval_count: 812, eval_count: 41 }),
    );
    const res = await ask(await signIn("+919844500009"), { prompt: "hi", purpose: "worker_questions" });
    expect(res.status).toBe(200);
    const { usage } = (await res.json()) as { usage: Record<string, number> };
    expect(usage).toMatchObject({ load_ms: 2500, prompt_tokens: 812, reply_tokens: 41 });
    expect((await ask(await signIn("+919844500009"), { prompt: "hi", purpose: "gossip" })).status).toBe(400);
  });

  it("never lets the caller pick the model", async () => {
    const fetched = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ response: "ok" }));
    await ask(await signIn("+919844500002"), { prompt: "hi", model: "something-else" });
    expect(JSON.parse(String(fetched.mock.calls[0]?.[1]?.body)).model).toBe(NAME);
  });

  it("needs a session", async () => {
    expect((await ask(undefined, { prompt: "hi" })).status).toBe(401);
  });

  it("refuses an empty or overlong prompt", async () => {
    const owner = await signIn("+919844500003");
    expect((await ask(owner, { prompt: "" })).status).toBe(400);
    expect((await ask(owner, { prompt: "x".repeat(MODEL_PROMPT_MAX + 1) })).status).toBe(400);
    expect((await ask(owner, { prompt: "hi", max_tokens: 100_000 })).status).toBe(400);
  });

  it("answers 503 when no model is set up, so the phone uses its own", async () => {
    const fetched = vi.spyOn(globalThis, "fetch");
    const res = await ask(await signIn("+919844500004"), { prompt: "hi" }, { MODEL_ORIGIN: undefined });
    expect(res.status).toBe(503);
    expect(fetched).not.toHaveBeenCalled();
  });

  it("answers 502 when the model fails or cannot be reached", async () => {
    const owner = await signIn("+919844500005");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("down", { status: 500 }));
    expect((await ask(owner, { prompt: "hi" })).status).toBe(502);
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("connection refused"));
    expect((await ask(owner, { prompt: "hi" })).status).toBe(502);
  });
});

describe("whether GigSync's model is set up", () => {
  const status = (more: Record<string, string | undefined>) =>
    signIn("+919844500006").then((as) =>
      app.fetch(
        new Request("http://x/v1/model/status", {
          headers: { [Header.authorization]: `${BEARER_PREFIX}${as.session.token}` },
        }),
        { ...env, ...more },
        createExecutionContext(),
      ),
    );

  it("says so, so a phone asks only when there is one", async () => {
    expect(await (await status(CONFIGURED)).json()).toEqual({ on: true });
    expect(await (await status({ MODEL_ORIGIN: undefined })).json()).toEqual({ on: false });
  });
});
