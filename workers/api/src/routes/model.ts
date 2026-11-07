import { ContentType, Header, HttpMethod } from "@gigsync/core";
import { log } from "@gigsync/core/log";
import { type ModelGenerateReply, ModelGenerateRequest, type ServerModelStatus } from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, Var } from "../context.js";
import type { Env } from "../env.js";

/**
 * GigSync's own model (ADR 0052): the phone's prompt, answered by the model on GigSync's computer (Ollama on the Mac
 * Studio, behind a Cloudflare Tunnel). The model is the server's (`MODEL_NAME`), never the caller's, and what was said
 * is never logged or kept: only how long it took and whether it answered. Unset `MODEL_ORIGIN` answers 503, and the
 * phone falls back to its own model or lite mode.
 */
export const model = new Hono<AppEnv>();

const Path = { generate: "/generate", status: "/status" } as const;
const OLLAMA_GENERATE = "/api/generate";
/** Ollama's `format` for any JSON object. */
const JSON_FORMAT = "json";
/** Longer than any answer the agent waits for; the phone gives up sooner and falls back. */
const MODEL_TIMEOUT_MS = 15_000;
/**
 * How long Ollama keeps the model loaded after a call. Its default is five minutes, and loading it again takes longer
 * than a phone waits (about 9 s against 4 s), so the first message after a quiet spell was read by no model at all.
 */
const MODEL_KEEP_ALIVE = "24h";
/** Cloudflare Access service-token headers, for the tunnel in front of the model. */
const AccessHeader = { id: "CF-Access-Client-Id", secret: "CF-Access-Client-Secret" } as const;

/** The headers the model's host needs: Cloudflare Access's service token, when the tunnel is behind Access. */
function accessHeaders(env: Env): Record<string, string> {
  if (!env.MODEL_ACCESS_ID || !env.MODEL_ACCESS_SECRET) return {};
  return { [AccessHeader.id]: env.MODEL_ACCESS_ID, [AccessHeader.secret]: env.MODEL_ACCESS_SECRET };
}

/** Ollama's request for this prompt: no hidden reasoning first, and JSON held to the schema when asked. */
const ollamaBody = (name: string, r: ModelGenerateRequest) => ({
  model: name,
  prompt: r.prompt,
  stream: false,
  think: false,
  keep_alive: MODEL_KEEP_ALIVE,
  ...(r.json ? { format: r.schema ?? JSON_FORMAT } : {}),
  options: {
    ...(r.max_tokens === undefined ? {} : { num_predict: r.max_tokens }),
    ...(r.temperature === undefined ? {} : { temperature: r.temperature }),
  },
});

/** Whether a model is set up here, so a phone knows to ask: its words go nowhere when none is. */
model.get(Path.status, (c) =>
  c.json({ on: Boolean(c.env.MODEL_ORIGIN && c.env.MODEL_NAME) } satisfies ServerModelStatus),
);

model.post(Path.generate, async (c) => {
  const requestId = c.get(Var.requestId);
  if (!(await c.env.MODEL_RATE_LIMIT.limit({ key: c.get(Var.user) })).success)
    return c.json({ error: ApiError.tooManyAttempts }, 429);
  const parsed = ModelGenerateRequest.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: ApiError.badRequest }, 400);
  const { MODEL_ORIGIN: origin, MODEL_NAME: name } = c.env;
  if (!origin || !name) return c.json({ error: ApiError.modelOff }, 503);
  const start = Date.now();
  try {
    const res = await fetch(`${origin}${OLLAMA_GENERATE}`, {
      method: HttpMethod.post,
      headers: { [Header.contentType]: ContentType.json, ...accessHeaders(c.env) },
      body: JSON.stringify(ollamaBody(name, parsed.data)),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });
    if (!res.ok) {
      log.warn("model failed", { requestId, status: res.status, ms: Date.now() - start });
      return c.json({ error: ApiError.modelFailed }, 502);
    }
    const { response } = (await res.json()) as { response?: string };
    log.info("model answered", { requestId, ms: Date.now() - start });
    return c.json({ text: response?.trim() || null } satisfies ModelGenerateReply);
  } catch (err) {
    // A fetch failure's message names the host or the reason, never what was said.
    const error = err instanceof Error ? `${err.name}: ${err.message}` : typeof err;
    log.warn("model unreachable", { requestId, error });
    return c.json({ error: ApiError.modelFailed }, 502);
  }
});
