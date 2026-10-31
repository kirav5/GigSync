// A Node `Model` served by Ollama, with the request apps/mobile/src/adapters/ollama.ts sends, that also keeps what
// each call returned and how long it took, so the runner can say why the model router fell back.
import { core } from "./core.mjs";

export const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:1.5b";
const GENERATE_PATH = "/api/generate";
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

  async generate(prompt, options) {
    const started = performance.now();
    const call = { reply: null, ms: 0, error: undefined };
    this.calls.push(call);
    const work = this.#ask(prompt, options, call).finally(() => {
      call.ms = performance.now() - started;
    });
    this.#pending.push(work);
    return work;
  }

  async #ask(prompt, options, call) {
    // The router's own options, as the app's adapter forwards them: temperature 0 keeps a run repeatable.
    const settings = { num_predict: options?.maxTokens ?? core.DEFAULT_MAX_TOKENS };
    if (options?.temperature !== undefined) settings.temperature = options.temperature;
    try {
      const res = await fetch(`${OLLAMA_URL}${GENERATE_PATH}`, {
        method: core.HttpMethod.post,
        body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, options: settings }),
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

  async settled() {
    await Promise.allSettled(this.#pending);
  }
}
