import { DEFAULT_MAX_TOKENS, type GenerateOptions, HttpMethod, log, type Model } from "@gigsync/core";

/** Where `ollama serve` listens by default. */
const OLLAMA_URL = "http://localhost:11434";
/** Ollama's `format` for any JSON object. */
const JSON_FORMAT = "json";
const GENERATE_PATH = "/api/generate";
const TAGS_PATH = "/api/tags";

/**
 * DEV ONLY: a model served by Ollama on this computer, so the web build can be tried with a real model before the
 * phones' on-device engines exist. Chosen in Settings › On-device model (dev builds only).
 */
export class OllamaModel implements Model {
  constructor(
    readonly name: string,
    private base = OLLAMA_URL,
  ) {}

  async generate(prompt: string, options?: GenerateOptions) {
    try {
      const res = await fetch(`${this.base}${GENERATE_PATH}`, {
        method: HttpMethod.post,
        body: JSON.stringify({
          model: this.name,
          prompt,
          stream: false,
          // No hidden reasoning first (Qwen3.5 and Qwen3 think by default); models that cannot think ignore it.
          think: false,
          // Ollama holds the output to a JSON Schema, or to any JSON, as the phone's engine does.
          ...(options?.json ? { format: options.schema ?? JSON_FORMAT } : {}),
          options: {
            num_predict: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
            ...(options?.temperature === undefined ? {} : { temperature: options.temperature }),
          },
        }),
      });
      if (!res.ok) {
        log.warn("ollama: request failed", { model: this.name, status: res.status });
        return null;
      }
      const { response } = (await res.json()) as { response?: string };
      return response?.trim() || null;
    } catch (error) {
      log.warn("ollama: not reachable; is `ollama serve` running?", { model: this.name, error });
      return null;
    }
  }
}

/** The models Ollama on this computer has pulled, for Settings to offer; empty when Ollama is not running. */
export async function listOllamaModels(base = OLLAMA_URL): Promise<string[]> {
  try {
    const res = await fetch(`${base}${TAGS_PATH}`);
    if (!res.ok) return [];
    const { models } = (await res.json()) as { models?: { name?: string }[] };
    return (models ?? []).flatMap((m) => (m.name ? [m.name] : []));
  } catch {
    return [];
  }
}
