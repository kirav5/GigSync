import { Collection, type GenerateOptions, log, type Model, pii, type Storage, withoutReasoning } from "@gigsync/core";
import type { Session } from "@gigsync/protocol";
import { useSyncExternalStore } from "react";
import { OllamaModel } from "./ollama.js";
import { ServerModel } from "./server-model.js";

/**
 * Which model the agent uses, chosen in Settings and kept on this device. Everything goes through core's `Model`
 * port, so the agent never knows which engine answered (HLD principle 6).
 *   auto:   GigSync's own model on GigSync's computer (ADR 0052); when it cannot answer, lite mode
 *   lite:   no generative model: the Privacy switch turned off, so nothing typed leaves the phone
 *   ollama: development builds only, a model served by Ollama on this computer
 * `server` is never chosen as such: it is what answers under auto while GigSync's model can be asked. Lite is named on
 * no screen: rules, templates and the understanding pack (embedder.ts, ADR 0042 and 0065) do every job. No generative
 * model runs on the phone on any platform (2026-11-15): the web no longer downloads one, as the apps never did.
 */
export const ModelChoice = {
  auto: "auto",
  lite: "lite",
  ollama: "ollama",
  server: "server",
} as const;
export type ModelChoice = (typeof ModelChoice)[keyof typeof ModelChoice];

export interface ModelSettings {
  choice: ModelChoice;
  /** Only for Ollama: the name of a model pulled on this computer. */
  ollamaModel: string;
}

/** Ollama is offered only in development builds; release builds never call this computer's localhost. */
export const OLLAMA_OFFERED = import.meta.env.DEV;

const SETTINGS_KEY = "model";
/** The choice once saved for the phone's own generative model, read as lite now that there is none. */
const RETIRED_DEVICE_CHOICE = "device";
/** A development build given an Ollama model (`VITE_OLLAMA_MODEL`) uses it; there is no screen to pick one. */
const DEV_OLLAMA = OLLAMA_OFFERED ? (import.meta.env.VITE_OLLAMA_MODEL ?? "") : "";
const DEFAULTS: ModelSettings = {
  choice: DEV_OLLAMA ? ModelChoice.ollama : ModelChoice.auto,
  ollamaModel: DEV_OLLAMA,
};
/** The one `Model` the app hands to core; it routes each call to the engine chosen in Settings. */
export class ChosenModel implements Model {
  private settings: ModelSettings = DEFAULTS;
  private readonly listeners = new Set<() => void>();
  private version = 0;
  /** GigSync's own model, through the API (ADR 0052). */
  readonly server = new ServerModel(() => this.notify());
  /** A secret answer is being read (the lowest rate): it never leaves the phone, so no model reads it. */
  private secret = false;

  get current(): ModelSettings {
    return this.settings;
  }

  /** Reads the saved choice. */
  async load(storage: Storage): Promise<void> {
    const saved = await storage.get<Partial<ModelSettings>>(Collection.settings, SETTINGS_KEY);
    if (saved) this.settings = { ...DEFAULTS, ...saved };
    // The phone's own model was a choice once: lite keeps its promise (nothing leaves the phone).
    if ((this.settings.choice as string) === RETIRED_DEVICE_CHOICE) {
      this.settings = { ...this.settings, choice: ModelChoice.lite };
    }
    this.notify();
  }

  /** The signed-in owner's session, for GigSync's model; none once signed out. */
  setSession(session: Session | undefined): void {
    this.server.setSession(session);
    this.notify();
  }

  /** Set by the chat while a secret question is open: its answer is never sent to GigSync's model (ADR 0052). */
  holdOnPhone(secret: boolean): void {
    this.secret = secret;
  }

  async save(storage: Storage, next: ModelSettings): Promise<void> {
    this.settings = { choice: next.choice, ollamaModel: next.ollamaModel.trim() };
    await storage.put(Collection.settings, SETTINGS_KEY, this.settings);
    this.notify();
  }

  /**
   * The answer without the model's reasoning (model-reply.ts), whichever engine gave it; null when there is none. Each
   * call is logged by purpose with the engine, how long it took, whether it answered and the sizes; the words only
   * through `pii()`, which prints on a developer's machine and nowhere else.
   */
  async generate(prompt: string, options?: GenerateOptions): Promise<string | null> {
    await this.server.ready();
    const engine = this.answering();
    const started = performance.now();
    const raw = await this.ask(prompt, options);
    const reply = raw === null ? null : withoutReasoning(raw) || null;
    const ms = Math.round(performance.now() - started);
    const call = { purpose: options?.purpose, engine, ms, answered: reply !== null };
    log.info("model call", { ...call, prompt_chars: prompt.length, reply_chars: reply?.length ?? 0 });
    log.debug("model call words", { purpose: options?.purpose, prompt: pii(prompt), reply: pii(reply ?? "") });
    return reply;
  }

  private async ask(prompt: string, options?: GenerateOptions): Promise<string | null> {
    switch (this.answering()) {
      case ModelChoice.server:
        return this.server.generate(prompt, options);
      case ModelChoice.ollama:
        return new OllamaModel(this.settings.ollamaModel).generate(prompt, options);
      default:
        return null;
    }
  }

  /** Which engine answers right now: GigSync's model, Ollama, or none at all (`lite`). */
  answering(): ModelChoice {
    switch (this.settings.choice) {
      case ModelChoice.ollama:
        return OLLAMA_OFFERED && this.settings.ollamaModel ? ModelChoice.ollama : ModelChoice.lite;
      case ModelChoice.lite:
        return ModelChoice.lite;
      default:
        return !this.secret && this.server.available ? ModelChoice.server : ModelChoice.lite;
    }
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  snapshot = () => this.version;

  private notify() {
    this.version += 1;
    for (const fn of this.listeners) fn();
  }
}

/** The app's single model router. */
export const chosenModel = new ChosenModel();

/** Re-renders a component whenever the model choice or GigSync's model's reach changes. */
export function useChosenModel(): ChosenModel {
  useSyncExternalStore(chosenModel.subscribe, chosenModel.snapshot);
  return chosenModel;
}
