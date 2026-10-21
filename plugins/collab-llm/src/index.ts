import { registerPlugin } from "@capacitor/core";
import type { CollabLLMPlugin } from "./definitions.js";

export const CollabLLM = registerPlugin<CollabLLMPlugin>("CollabLLM", {
  web: () => import("./web.js").then((m) => new m.CollabLLMWeb()),
});

export * from "./definitions.js";
