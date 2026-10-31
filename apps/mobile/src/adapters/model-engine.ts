import {
  type GenerateOptions,
  type GenerateResult,
  GigSyncLLM,
  type ModelOptions,
  type ModelStatus,
  PROGRESS_EVENT,
} from "@gigsync/plugin-llm";

/**
 * The device's own model engine, as the app's adapters use it: the plugin (WebLLM on the web, the native engines in
 * the apps), or in development a scripted engine (model-fake.ts) so UI tests can walk the download without a GPU.
 * Every failure reads as "no model", so the agent carries on in lite mode.
 */
export interface ModelEngine {
  status(options: ModelOptions): Promise<ModelStatus>;
  /** Downloads and loads the model, telling `onProgress` each step; resolves when it is ready or the download stopped. */
  prepare(options: ModelOptions, onProgress: (status: ModelStatus) => void): Promise<ModelStatus>;
  generate(options: GenerateOptions): Promise<GenerateResult>;
  remove(options: ModelOptions): Promise<ModelStatus>;
}

/** The plugin's name for "no engine on this device". */
export const ENGINE_NONE = "none";
export const NO_MODEL: ModelStatus = { available: false, engine: ENGINE_NONE };

const device: ModelEngine = {
  status: (o) => GigSyncLLM.status(o),
  async prepare(o, onProgress) {
    const listener = await GigSyncLLM.addListener(PROGRESS_EVENT, onProgress);
    try {
      return await GigSyncLLM.prepare(o);
    } finally {
      await listener.remove();
    }
  },
  generate: (o) => GigSyncLLM.generate(o),
  remove: (o) => GigSyncLLM.remove(o),
};

let chosen: Promise<ModelEngine> | undefined;
/** Release builds fold the DEV branch away, and the fake's module with it. */
export function modelEngine(): Promise<ModelEngine> {
  chosen ??= import.meta.env.DEV
    ? import("./model-fake.js").then((m) => m.fakeModel() ?? device)
    : Promise.resolve(device);
  return chosen;
}
