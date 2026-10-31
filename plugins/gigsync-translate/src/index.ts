import { registerPlugin } from "@capacitor/core";
import type { GigSyncTranslatePlugin } from "./definitions.js";

export const GigSyncTranslate = registerPlugin<GigSyncTranslatePlugin>("GigSyncTranslate", {
  web: () => import("./web.js").then((m) => new m.GigSyncTranslateWeb()),
});

export * from "./definitions.js";
