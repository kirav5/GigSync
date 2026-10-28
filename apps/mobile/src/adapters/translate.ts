import { type TranslateEngine, TranslateState, Translations } from "@gigsync/core";
import { GigSyncTranslate, type PairStatus } from "@gigsync/plugin-translate";
import type { Lang } from "@gigsync/protocol";

/** What runs translation on this device: Chrome's translator on the web, ML Kit on Android, Apple's on iPhone. */
export const ENGINE_NAMES: Readonly<Record<string, string>> = {
  "chrome-built-in": "Chrome (on this computer)",
  mlkit: "ML Kit (on this phone)",
  "apple-translation": "Apple Translation (on this phone)",
};
/** The engine name the plugin reports when nothing on this device can translate. */
export const NO_ENGINE = "none";
const NONE: PairStatus = { state: TranslateState.unavailable, engine: NO_ENGINE };

/** The pair's state and engine as the plugin reports them; "unavailable" when the plugin is missing or fails. */
export async function pairStatus(from: Lang, to: Lang): Promise<PairStatus> {
  try {
    return await GigSyncTranslate.state({ from, to });
  } catch {
    return NONE;
  }
}

/**
 * Bumped whenever a language pack finishes downloading, so every line of translated text on screen asks again,
 * not only the one whose button was tapped.
 */
let packs = 0;
const listeners = new Set<() => void>();
export const packsChanged = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  version: () => packs,
};

/** Fetches a language pack. Only from an owner's tap: engines refuse downloads without one. */
export async function preparePair(from: Lang, to: Lang): Promise<PairStatus> {
  try {
    return await GigSyncTranslate.prepare({ from, to });
  } catch {
    return NONE;
  } finally {
    packs += 1;
    for (const fn of listeners) fn();
  }
}

const engine: TranslateEngine = {
  name: "device",
  state: async (from, to) => (await pairStatus(from, to)).state,
  prepare: async (from, to) => (await preparePair(from, to)).state,
  translate: async (text, from, to) => {
    const r = await GigSyncTranslate.translate({ text, from, to });
    return r.available ? r.text : undefined;
  },
};

/** One per app: translations are cached across screens and syncs. */
export const translations = new Translations(engine);
