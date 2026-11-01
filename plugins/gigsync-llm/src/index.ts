import { registerPlugin } from "@capacitor/core";
import type { GigSyncLLMPlugin } from "./definitions.js";

export const GigSyncLLM = registerPlugin<GigSyncLLMPlugin>("GigSyncLLM", {
  web: () => import("./web.js").then((m) => new m.GigSyncLLMWeb()),
});

export { MODEL } from "./catalog.js";
export * from "./definitions.js";
