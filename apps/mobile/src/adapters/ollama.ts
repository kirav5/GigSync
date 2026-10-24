import { DEFAULT_MAX_TOKENS, HttpMethod, log, type Model } from "@gigsync/core";

/** Where `ollama serve` listens by default. */
const OLLAMA_URL = "http://localhost:11434";
const GENERATE_PATH = "/api/generate";

/**
 * DEV ONLY: a model served by Ollama on this computer, so the web build can be tried with a real model before the
 * phones' on-device engines exist. Chosen in createPorts() when VITE_OLLAMA_MODEL is set in a dev build.
 */
export class OllamaModel implements Model {
  constructor(
    readonly name: string,
    private base = OLLAMA_URL,
  ) {}

  async generate(prompt: string, options?: { maxTokens?: number }) {
    try {
      const res = await fetch(`${this.base}${GENERATE_PATH}`, {
        method: HttpMethod.post,
        body: JSON.stringify({
          model: this.name,
          prompt,
          stream: false,
          options: { num_predict: options?.maxTokens ?? DEFAULT_MAX_TOKENS },
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
