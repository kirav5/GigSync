// A Node `Model` that keeps what each call returned and how long it took, so the runner can say why the model router
// fell back. Answers come from Ollama, with the request apps/mobile/src/adapters/ollama.ts sends, or from another
// engine's `ask` (webllm.mjs runs the phone's own builds in a browser).
import { core } from "./core.mjs";

export const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:1.5b";
const GENERATE_PATH = "/api/generate";
/** Ollama's `format` for any JSON object. */
const JSON_FORMAT = "json";
const TAGS_PATH = "/api/tags";
/** A request this slow is abandoned: far past any phone's time limit, so nothing is lost by stopping it. */
const REQUEST_LIMIT_MS = 60_000;
const TAGS_LIMIT_MS = 3_000;

/** True when Ollama answers and has pulled the model. */
export async function ollamaReady() {
  try {
    const res = await fetch(`${OLLAMA_URL}${TAGS_PATH}`, { signal: AbortSignal.timeout(TAGS_LIMIT_MS) });
    if (!res.ok) return false;
    const { models } = await res.json();
    return (models ?? []).some((m) => m.name === OLLAMA_MODEL);
  } catch {
    return false;
  }
}

/**
 * One case's model calls: the raw reply (null when there was none), the time each took, and any network error.
 * `settled()` waits for a call the router stopped waiting on, so the next case does not share Ollama with it.
 */
export class RecordingModel {
  calls = [];
  #pending = [];

  /** `ask(prompt, options, call)` sets `call.reply` (or `call.error`) and resolves to the reply or null. */
  constructor(ask = askOllama) {
    this.ask = ask;
  }

  async generate(prompt, options) {
    const started = performance.now();
    const call = { reply: null, ms: 0, error: undefined };
    this.calls.push(call);
    const work = this.ask(prompt, options, call).finally(() => {
      call.ms = performance.now() - started;
    });
    this.#pending.push(work);
    return work;
  }

  async settled() {
    await Promise.allSettled(this.#pending);
  }
}

/** One answer from Ollama. */
export async function askOllama(prompt, options, call) {
  // The router's own options, as the app's adapter forwards them: temperature 0 keeps a run repeatable.
  const settings = { num_predict: options?.maxTokens ?? core.DEFAULT_MAX_TOKENS };
  if (options?.temperature !== undefined) settings.temperature = options.temperature;
  try {
    const res = await fetch(`${OLLAMA_URL}${GENERATE_PATH}`, {
      method: core.HttpMethod.post,
      // No hidden reasoning first (Qwen3.5 and Qwen3 think by default): the router waits for one short JSON reply.
      // Held to the router's JSON Schema, as the phone's WebLLM holds it (apps/mobile/src/adapters/ollama.ts does too).
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        think: false,
        ...(options?.json ? { format: options.schema ?? JSON_FORMAT } : {}),
        options: settings,
      }),
      signal: AbortSignal.timeout(REQUEST_LIMIT_MS),
    });
    if (!res.ok) {
      call.error = `HTTP ${res.status}`;
      return null;
    }
    const { response } = await res.json();
    call.reply = response?.trim() || null;
    return call.reply;
  } catch (error) {
    call.error = error.name;
    return null;
  }
}

/**
 * `ask` that answers a prompt it has seen with the reply it gave then. The router asks at temperature 0, so the
 * combined run reuses the model-only run's answer instead of waiting for the model twice.
 */
export function remembering(ask) {
  const replies = new Map();
  return async (prompt, options, call) => {
    if (replies.has(prompt)) {
      call.reply = replies.get(prompt);
      return call.reply;
    }
    const reply = await ask(prompt, options, call);
    if (!call.error) replies.set(prompt, reply);
    return reply;
  };
}
