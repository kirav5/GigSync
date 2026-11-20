import { Collection, type GenerateOptions, log, type Model, pii, type Storage, withoutReasoning } from "@gigsync/core";
import { OllamaModel } from "./ollama.js";

/**
 * Which model the agent uses, kept on this device. Everything goes through core's `Model` port, so the agent never
 * knows which engine answered (HLD principle 6).
 *   lite:   no generative model: rules, templates and the understanding pack (embedder.ts, ADR 0042 and 0065) do
 *           every job, on the phone, and nothing typed leaves it
 *   ollama: development builds only, a model served by Ollama on this computer
 * Release builds are always lite: no generative model runs on the phone on any platform (2026-11-15), and GigSync runs
 * none of its own (2026-11-20, ADR 0070).
 */
export const ModelChoice = {
  lite: "lite",
  ollama: "ollama",
} as const;
export type ModelChoice = (typeof ModelChoice)[keyof typeof ModelChoice];

interface ModelSettings {
  choice: ModelChoice;
  /** Only for Ollama: the name of a model pulled on this computer. */
  ollamaModel: string;
}

/** Ollama is offered only in development builds; release builds never call this computer's localhost. */
export const OLLAMA_OFFERED = import.meta.env.DEV;

const SETTINGS_KEY = "model";
/** A development build given an Ollama model (`VITE_OLLAMA_MODEL`) uses it; there is no screen to pick one. */
const DEV_OLLAMA = OLLAMA_OFFERED ? (import.meta.env.VITE_OLLAMA_MODEL ?? "") : "";
const DEFAULTS: ModelSettings = {
  choice: DEV_OLLAMA ? ModelChoice.ollama : ModelChoice.lite,
  ollamaModel: DEV_OLLAMA,
};
const CHOICES: readonly string[] = Object.values(ModelChoice);

/** The one `Model` the app hands to core; it routes each call to the engine chosen on this device. */
export class ChosenModel implements Model {
  private settings: ModelSettings = DEFAULTS;

  /** Reads the saved choice; one saved by an older app (the phone's own model, GigSync's) reads as lite. */
  async load(storage: Storage): Promise<void> {
    const saved = await storage.get<Partial<ModelSettings>>(Collection.settings, SETTINGS_KEY);
    if (saved) this.settings = { ...DEFAULTS, ...saved };
    if (!CHOICES.includes(this.settings.choice)) this.settings = { ...this.settings, choice: ModelChoice.lite };
  }

  /**
   * The answer without the model's reasoning (model-reply.ts), whichever engine gave it; null when there is none. Each
   * call is logged by purpose with the engine, how long it took, whether it answered and the sizes; the words only
   * through `pii()`, which prints on a developer's machine and nowhere else.
   */
  async generate(prompt: string, options?: GenerateOptions): Promise<string | null> {
    const engine = this.answering();
    if (engine === ModelChoice.lite) return null;
    const started = performance.now();
    const raw = await new OllamaModel(this.settings.ollamaModel).generate(prompt, options);
    const reply = raw === null ? null : withoutReasoning(raw) || null;
    const ms = Math.round(performance.now() - started);
    const call = { purpose: options?.purpose, engine, ms, answered: reply !== null };
    log.info("model call", { ...call, prompt_chars: prompt.length, reply_chars: reply?.length ?? 0 });
    log.debug("model call words", { purpose: options?.purpose, prompt: pii(prompt), reply: pii(reply ?? "") });
    return reply;
  }

  /** Which engine answers right now: Ollama in a development build given one, else none at all (`lite`). */
  answering(): ModelChoice {
    const ollama = this.settings.choice === ModelChoice.ollama && OLLAMA_OFFERED && this.settings.ollamaModel;
    return ollama ? ModelChoice.ollama : ModelChoice.lite;
  }
}

/** The app's single model router. */
export const chosenModel = new ChosenModel();
