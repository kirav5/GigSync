import type { BrowserContext } from "@playwright/test";

/**
 * Stands in for Chrome's built-in Translator API in tests: the same `Translator.availability` / `create` /
 * `translate` shape the app's web engine calls, answering from a fixed table instead of a downloaded model. It proves
 * the app's path (engine, number check, marked rendering), not translation quality. Keys are "from>to:text".
 */
export type TranslationTable = Readonly<Record<string, string>>;

export const pairKey = (from: string, to: string, text: string) => `${from}>${to}:${text}`;

export async function useTableTranslator(context: BrowserContext, table: TranslationTable): Promise<void> {
  await context.addInitScript((entries: TranslationTable) => {
    const known = new Set(Object.keys(entries).map((k) => k.slice(0, k.indexOf(":"))));
    (globalThis as Record<string, unknown>).Translator = {
      availability: async ({ sourceLanguage, targetLanguage }: { sourceLanguage: string; targetLanguage: string }) =>
        known.has(`${sourceLanguage}>${targetLanguage}`) ? "available" : "downloadable",
      create: async ({ sourceLanguage, targetLanguage }: { sourceLanguage: string; targetLanguage: string }) => ({
        translate: async (text: string) => entries[`${sourceLanguage}>${targetLanguage}:${text}`] ?? text,
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
