import { WebPlugin } from "@capacitor/core";
import type { GenerateOptions, GenerateResult, GigSyncLLMPlugin, ModelStatus } from "./definitions.js";

/** The browser has no model in M0. An in-browser engine (as in collab-market) can plug in here later. */
export class GigSyncLLMWeb extends WebPlugin implements GigSyncLLMPlugin {
  async status(): Promise<ModelStatus> {
    return { available: false, engine: "none" };
  }
  async generate(_options: GenerateOptions): Promise<GenerateResult> {
    return { available: false, text: "", engine: "none" };
  }
}
