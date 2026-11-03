import {
  Collection,
  type GenerateOptions,
  type MessageKey,
  type Model,
  type Params,
  type Storage,
  withoutReasoning,
} from "@gigsync/core";
import type { ModelStatus } from "@gigsync/plugin-llm";
import { useSyncExternalStore } from "react";
import { OnDevice } from "./model-device.js";
import { ENGINE_NONE } from "./model-engine.js";
import { OllamaModel } from "./ollama.js";

export { Notice } from "./model-device.js";
export { ENGINE_NONE } from "./model-engine.js";

/**
 * Which model the agent uses, chosen in Settings and kept on this device. Everything goes through core's `Model`
 * port, so the agent never knows which engine answered (HLD principle 6).
 *   auto:   the device's own model once it is downloaded and ready and has the memory; otherwise lite mode
 *   device: always try the device's own model (WebLLM in the web app; LiteRT-LM on Android, Apple Foundation Models)
 *   lite:   no model at all: rules and templates do every job
 *   ollama: development builds only, a model served by Ollama on this computer
 */
export const ModelChoice = { auto: "auto", device: "device", lite: "lite", ollama: "ollama" } as const;
export type ModelChoice = (typeof ModelChoice)[keyof typeof ModelChoice];

export interface ModelSettings {
  choice: ModelChoice;
  /** Only for Ollama: the name of a model pulled on this computer. */
  ollamaModel: string;
}

/** Ollama is offered only in development builds; release builds never call this computer's localhost. */
export const OLLAMA_OFFERED = import.meta.env.DEV;

const SETTINGS_KEY = "model";
const DEFAULTS: ModelSettings = {
  choice: ModelChoice.auto,
  ollamaModel: OLLAMA_OFFERED ? (import.meta.env.VITE_OLLAMA_MODEL ?? "") : "",
};
const ENGINE_NAMES: Readonly<Record<string, string>> = {
  litert: "LiteRT-LM",
  "foundation-models": "Apple Foundation Models",
};

/** The model's own name when the engine gives one, else the engine's. */
export const engineName = (status: ModelStatus | undefined) =>
  status?.model?.name ?? ENGINE_NAMES[status?.engine ?? ENGINE_NONE] ?? status?.engine ?? ENGINE_NONE;

/** The one `Model` the app hands to core; it routes each call to the engine chosen in Settings. */
export class ChosenModel implements Model {
  private settings: ModelSettings = DEFAULTS;
  private readonly listeners = new Set<() => void>();
  private version = 0;
  /** The phone's own model: its status and the download. */
  readonly device = new OnDevice(() => this.notify(), import.meta.env.VITE_MODEL_BASE_URL);

  get current(): ModelSettings {
    return this.settings;
  }

  get deviceInfo(): ModelStatus | undefined {
    return this.device.status;
  }

  /** Reads the saved choice and asks the device what it has. */
  async load(storage: Storage): Promise<void> {
    const saved = await storage.get<Partial<ModelSettings>>(Collection.settings, SETTINGS_KEY);
    if (saved) this.settings = { ...DEFAULTS, ...saved };
    await this.device.load(storage);
  }

  refresh = () => this.device.refresh();

  async save(storage: Storage, next: ModelSettings): Promise<void> {
    this.settings = { choice: next.choice, ollamaModel: next.ollamaModel.trim() };
    await storage.put(Collection.settings, SETTINGS_KEY, this.settings);
    this.notify();
  }

  /** The answer without the model's reasoning (model-reply.ts), whichever engine gave it; null when there is none. */
  async generate(prompt: string, options?: GenerateOptions): Promise<string | null> {
    const reply = await this.ask(prompt, options);
    return reply === null ? null : withoutReasoning(reply) || null;
  }

  private ask(prompt: string, options?: GenerateOptions): Promise<string | null> {
    switch (this.answering()) {
      case ModelChoice.ollama:
        return new OllamaModel(this.settings.ollamaModel).generate(prompt, options);
      case ModelChoice.device:
        return this.device.generate(prompt, options);
      default:
        return Promise.resolve(null);
    }
  }

  /** Which engine answers right now: the device's own model, Ollama, or none at all (lite mode). */
  answering(): ModelChoice {
    switch (this.settings.choice) {
      case ModelChoice.lite:
        return ModelChoice.lite;
      case ModelChoice.ollama:
        return OLLAMA_OFFERED && this.settings.ollamaModel ? ModelChoice.ollama : ModelChoice.lite;
      case ModelChoice.device:
        return this.device.status?.available ? ModelChoice.device : ModelChoice.lite;
      default:
        return this.device.usable() ? ModelChoice.device : ModelChoice.lite;
    }
  }

  /** One line for the screens, in the owner's language: which engine will answer right now. */
  label(t: (key: MessageKey, params?: Params) => string): string {
    const lite = t("model.lite_label");
    const device = t("model.on_device_label", { engine: engineName(this.device.status) });
    switch (this.settings.choice) {
      case ModelChoice.lite:
        return lite;
      case ModelChoice.ollama:
        return this.settings.ollamaModel ? t("model.ollama_label", { name: this.settings.ollamaModel }) : lite;
      case ModelChoice.device:
        return this.device.status?.available ? device : t("model.not_ready_lite", { device });
      default:
        return t("model.auto_label", { model: this.device.usable() ? device : lite });
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

/** Re-renders a component whenever the model choice or the device's status changes. */
export function useChosenModel(): ChosenModel {
  useSyncExternalStore(chosenModel.subscribe, chosenModel.snapshot);
  return chosenModel;
}
