import { WebPlugin } from "@capacitor/core";
import type { CollabLLMPlugin, GenerateOptions, GenerateResult, ModelStatus } from "./definitions.js";

/** The browser has no model in M0. An in-browser engine (as in collab-market) can plug in here later. */
export class CollabLLMWeb extends WebPlugin implements CollabLLMPlugin {
  async status(): Promise<ModelStatus> {
    return { available: false, engine: "none" };
  }
  async generate(_options: GenerateOptions): Promise<GenerateResult> {
    return { available: false, text: "", engine: "none" };
  }
}
