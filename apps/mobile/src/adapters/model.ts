import { Collection, DEFAULT_MAX_TOKENS, type Model, type Storage } from "@gigsync/core";
import { GigSyncLLM, type ModelStatus } from "@gigsync/plugin-llm";
import { useSyncExternalStore } from "react";
import { OllamaModel } from "./ollama.js";

/**
 * Which model the agent uses, chosen in Settings and kept on this device. Everything goes through core's `Model`
 * port, so the agent never knows which engine answered (HLD principle 6).
 *   auto:   the device's own model when it is ready and there is enough memory, otherwise lite mode
 *   device: always try the device's own model (LiteRT-LM on Android, Apple Foundation Models, the web engine)
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
  async generate(prompt: string, options?: { maxTokens?: number }) {
    try {
      const { text, available } = await GigSyncLLM.generate({
        prompt,
        maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
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

  async save(storage: Storage, next: ModelSettings): Promise<void> {
    this.settings = { choice: next.choice, ollamaModel: next.ollamaModel.trim() };
    await storage.put(Collection.settings, SETTINGS_KEY, this.settings);
    this.notify();
  }

  async generate(prompt: string, options?: { maxTokens?: number }): Promise<string | null> {
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

  /** One line for the screens: which engine will answer right now. */
  label(): string {
    const lite = "Lite mode (no model)";
    const deviceLabel = `On-device: ${engineName(this.status?.engine ?? ENGINE_NONE)}`;
    switch (this.settings.choice) {
      case ModelChoice.lite:
        return lite;
      case ModelChoice.ollama:
        return this.settings.ollamaModel ? `Ollama: ${this.settings.ollamaModel} (dev)` : lite;
      case ModelChoice.device:
        return this.status?.available ? deviceLabel : `${deviceLabel} · not ready, so lite mode`;
      default:
        return deviceUsable(this.status) ? `Auto · ${deviceLabel}` : `Auto · ${lite}`;
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
