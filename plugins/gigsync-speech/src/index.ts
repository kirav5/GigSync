import { registerPlugin } from "@capacitor/core";
import type { GigSyncSpeechPlugin } from "./definitions.js";

export const GigSyncSpeech = registerPlugin<GigSyncSpeechPlugin>("GigSyncSpeech", {
  web: () => import("./web.js").then((m) => new m.GigSyncSpeechWeb()),
});

export * from "./definitions.js";
