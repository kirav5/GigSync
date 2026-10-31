import type { Lang } from "@gigsync/protocol";
import { numbersIn } from "../job/details.js";

/**
 * Free text from the other side, translated on the reader's phone (multilanguage plan §3.4). The original is kept and
 * always shown; a translation is only a view of it. Core holds the rules; the engine (Chrome's built-in translator,
 * ML Kit on Android) sits behind `TranslateEngine` in the app, and nothing here ever calls a cloud service.
 */

/** What an engine can do for one language pair on this device. */
export const TranslateState = {
  available: "available",
  /** A language pack exists but must be fetched first; engines want a user's tap for that. */
  downloadable: "downloadable",
  downloading: "downloading",
  unavailable: "unavailable",
} as const;
export type TranslateState = (typeof TranslateState)[keyof typeof TranslateState];

export interface TranslateEngine {
  /** Which engine this is, shown in Settings so the owner can see what runs on their phone. */
  readonly name: string;
  state(from: Lang, to: Lang): Promise<TranslateState>;
  /** Fetches the pair's language pack. Call only from an owner's tap. */
  prepare(from: Lang, to: Lang): Promise<TranslateState>;
  /** The translation, or undefined when the engine could not translate this time. */
  translate(text: string, from: Lang, to: Lang): Promise<string | undefined>;
}

export const TranslationKind = { translated: "translated", unsafe: "unsafe", unavailable: "unavailable" } as const;

export type Translation =
  | { kind: typeof TranslationKind.translated; text: string }
  /** The engine dropped or changed a number, so the translation is withheld and the original shown alone. */
  | { kind: typeof TranslationKind.unsafe }
  | { kind: typeof TranslationKind.unavailable; state: TranslateState };

/**
 * True when every number in the original is still in the translation, in any script. A model may never change an
 * amount, a time or a count; extra numbers ("third" becoming "3rd") are allowed.
 */
export function numbersKept(original: string, translated: string): boolean {
  const left = numbersIn(translated);
  for (const n of numbersIn(original)) {
    const at = left.indexOf(n);
    if (at === -1) return false;
    left.splice(at, 1);
  }
  return true;
}

/** Enough for a screen of jobs and notes; the oldest entry goes first. */
const MAX_CACHED = 500;
const SEPARATOR = "\u0000";

/** Translates through one engine, once per text and pair, with the number check applied to every result. */
export class Translations {
  private readonly cache = new Map<string, Promise<Translation>>();

  constructor(readonly engine: TranslateEngine) {}

  translate(text: string, from: Lang, to: Lang): Promise<Translation> {
    const key = [from, to, text].join(SEPARATOR);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const next = this.run(text, from, to);
    this.cache.set(key, next);
    if (this.cache.size > MAX_CACHED) this.cache.delete(this.cache.keys().next().value as string);
    // A pair that was not ready may be ready later (after a download): do not keep "unavailable" answers.
    void next.then((r) => {
      if (r.kind === TranslationKind.unavailable) this.cache.delete(key);
    });
    return next;
  }

  private async run(text: string, from: Lang, to: Lang): Promise<Translation> {
    try {
      const state = await this.engine.state(from, to);
      if (state !== TranslateState.available) return { kind: TranslationKind.unavailable, state };
      const out = (await this.engine.translate(text, from, to))?.trim();
      if (!out) return { kind: TranslationKind.unavailable, state: TranslateState.unavailable };
      return numbersKept(text, out)
        ? { kind: TranslationKind.translated, text: out }
        : { kind: TranslationKind.unsafe };
    } catch {
      return { kind: TranslationKind.unavailable, state: TranslateState.unavailable };
    }
  }
}

/** The engine on a device that has none: every pair is unavailable and the original is shown alone. */
export const NO_TRANSLATOR: TranslateEngine = {
  name: "none",
  state: async () => TranslateState.unavailable,
  prepare: async () => TranslateState.unavailable,
  translate: async () => undefined,
};
