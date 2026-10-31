import {
  Collection,
  DEFAULT_MAX_TOKENS,
  type GenerateOptions,
  type MessageKey,
  type Model,
  type Params,
  type Storage,
} from "@gigsync/core";
import { GigSyncLLM, type ModelStatus } from "@gigsync/plugin-llm";
import { useSyncExternalStore } from "react";
import { OllamaModel } from "./ollama.js";

/**
 * Which model the agent uses, chosen in Settings and kept on this device. Everything goes through core's `Model`
 * port, so the agent never knows which engine answered (HLD principle 6).
 *   auto:   the device's own model when it is ready and there is enough memory, otherwise lite mode
 *   device: always try the device's own model (LiteRT-LM on Android, Apple Foundation Models, or Chrome's
 *           built-in Gemini Nano in desktop Chrome)
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
/** Below this much free memory, Auto stays in lite mode instead of loading a model (LLD §8.4). */
export const MIN_FREE_MB = 1500;
/** The plugin's name for "no engine on this device". */
export const ENGINE_NONE = "none";

const SETTINGS_KEY = "model";
const DEFAULTS: ModelSettings = {
  choice: ModelChoice.auto,
  ollamaModel: OLLAMA_OFFERED ? (import.meta.env.VITE_OLLAMA_MODEL ?? "") : "",
};
const ENGINE_NAMES: Readonly<Record<string, string>> = {
  litert: "LiteRT-LM",
  "foundation-models": "Apple Foundation Models",
  "chrome-built-in": "Chrome's built-in model (Gemini Nano)",
};

export const engineName = (engine: string) => ENGINE_NAMES[engine] ?? engine;

/** What the device's own engine reports; "none" when the plugin is missing or has no model. */
export async function deviceStatus(): Promise<ModelStatus> {
  try {
    return await GigSyncLLM.status();
  } catch {
    return { available: false, engine: ENGINE_NONE };
  }
}

/** True when Auto should use the device's model: it is ready, and the phone has the memory for it. */
export const deviceUsable = (s: ModelStatus | undefined) =>
  Boolean(s?.available) && (s?.freeMemoryMb === undefined || s.freeMemoryMb >= MIN_FREE_MB);

class DeviceModel implements Model {
  async generate(prompt: string, options?: GenerateOptions) {
    try {
      const { text, available } = await GigSyncLLM.generate({
        prompt,
        maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(options?.temperature === undefined ? {} : { temperature: options.temperature }),
      });
      return available ? text : null;
    } catch {
      return null;
    }
  }
}

/** The one `Model` the app hands to core; it routes each call to the engine chosen in Settings. */
export class ChosenModel implements Model {
  private settings: ModelSettings = DEFAULTS;
  private status: ModelStatus | undefined;
  private readonly device = new DeviceModel();
  private readonly listeners = new Set<() => void>();
  private version = 0;

  get current(): ModelSettings {
    return this.settings;
  }

  get deviceInfo(): ModelStatus | undefined {
    return this.status;
  }

  /** Reads the saved choice and asks the device what it has. */
  async load(storage: Storage): Promise<void> {
    const saved = await storage.get<Partial<ModelSettings>>(Collection.settings, SETTINGS_KEY);
    if (saved) this.settings = { ...DEFAULTS, ...saved };
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.status = await deviceStatus();
    this.notify();
  }

  /** Asks the engine to fetch its model (Chrome's one-time download). Call only from a tap. */
  async prepare(): Promise<void> {
    try {
      this.status = await GigSyncLLM.prepare();
    } catch {
      this.status = await deviceStatus();
    }
    this.notify();
  }

  async save(storage: Storage, next: ModelSettings): Promise<void> {
    this.settings = { choice: next.choice, ollamaModel: next.ollamaModel.trim() };
    await storage.put(Collection.settings, SETTINGS_KEY, this.settings);
    this.notify();
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string | null> {
    switch (this.settings.choice) {
      case ModelChoice.lite:
        return null;
      case ModelChoice.ollama:
        if (!OLLAMA_OFFERED || !this.settings.ollamaModel) return null;
        return new OllamaModel(this.settings.ollamaModel).generate(prompt, options);
      case ModelChoice.device:
        return this.device.generate(prompt, options);
      default:
        return deviceUsable(this.status) ? this.device.generate(prompt, options) : null;
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
        return this.status?.available ? ModelChoice.device : ModelChoice.lite;
      default:
        return deviceUsable(this.status) ? ModelChoice.device : ModelChoice.lite;
    }
  }

  /** One line for the screens, in the owner's language: which engine will answer right now. */
  label(t: (key: MessageKey, params?: Params) => string): string {
    const lite = t("model.lite_label");
    const device = t("model.on_device_label", { engine: engineName(this.status?.engine ?? ENGINE_NONE) });
    switch (this.settings.choice) {
      case ModelChoice.lite:
        return lite;
      case ModelChoice.ollama:
        return this.settings.ollamaModel ? t("model.ollama_label", { name: this.settings.ollamaModel }) : lite;
      case ModelChoice.device:
        return this.status?.available ? device : t("model.not_ready_lite", { device });
      default:
        return t("model.auto_label", { model: deviceUsable(this.status) ? device : lite });
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
