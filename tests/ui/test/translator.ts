import type { BrowserContext } from "@playwright/test";

/**
 * Stands in for Chrome's built-in Translator API in tests: the same `Translator.availability` / `create` /
 * `translate` shape the app's web engine calls, answering from a fixed table instead of a downloaded model. It proves
 * the app's path (engine, number check, what the reader sees), not translation quality. Keys are "from>to:text".
 *
 * A line that is not in the table whole is translated phrase by phrase, longest first, as a request's "when" from
 * before the When chips would be ("ಪ್ರತಿದಿನ ಬೆಳಗ್ಗೆ 7–10"). Words left untranslated stay as they are, which a test can
 * see.
 */
export type TranslationTable = Readonly<Record<string, string>>;

export const pairKey = (from: string, to: string, text: string) => `${from}>${to}:${text}`;

export async function useTableTranslator(context: BrowserContext, table: TranslationTable): Promise<void> {
  await context.addInitScript((entries: TranslationTable) => {
    const known = new Set(Object.keys(entries).map((k) => k.slice(0, k.indexOf(":"))));
    const translate = (pair: string, text: string) => {
      const whole = entries[`${pair}:${text}`];
      if (whole !== undefined) return whole;
      const phrases = Object.keys(entries)
        .filter((k) => k.startsWith(`${pair}:`))
        .map((k) => k.slice(pair.length + 1))
        .sort((a, b) => b.length - a.length);
      return phrases.reduce((out, phrase) => out.split(phrase).join(entries[`${pair}:${phrase}`] ?? phrase), text);
    };
    (globalThis as Record<string, unknown>).Translator = {
      availability: async ({ sourceLanguage, targetLanguage }: { sourceLanguage: string; targetLanguage: string }) =>
        known.has(`${sourceLanguage}>${targetLanguage}`) ? "available" : "downloadable",
      create: async ({ sourceLanguage, targetLanguage }: { sourceLanguage: string; targetLanguage: string }) => ({
        translate: async (text: string) => translate(`${sourceLanguage}>${targetLanguage}`, text),
      }),
    };
  }, table);
}

/** Chrome as seen headless with no language packs: the API exists, and `availability()` never answers. */
export async function useSilentTranslator(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    (globalThis as Record<string, unknown>).Translator = {
      availability: () => new Promise(() => undefined),
      create: () => new Promise(() => undefined),
    };
  });
}
