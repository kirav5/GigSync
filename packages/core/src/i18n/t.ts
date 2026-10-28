import type { Lang, QuestionKey } from "@gigsync/protocol";
import { en, type MessageKey, type Strings } from "./en/index.js";
import { hi } from "./hi/index.js";
import { kn } from "./kn/index.js";

export type { MessageKey } from "./en/index.js";

/** Every language's strings. A new language is one folder and one line here, plus its value in `Lang`. */
const STRINGS: Readonly<Record<Lang, Strings>> = { en, hi, kn };

/** The locale each language formats dates and times with. Digits stay Western, as UPI apps and bank SMS show them. */
export const LOCALE: Readonly<Record<Lang, string>> = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" };

const PLACEHOLDER = /\{(\w+)\}/g;
const ONE = "one";

export type Params = Readonly<Record<string, string | number>>;

/** The string for `key` in `lang`, with `{name}` placeholders filled from `params` (left as is when not given). */
export function t(lang: Lang, key: MessageKey, params: Params = {}): string {
  return STRINGS[lang][key].replace(PLACEHOLDER, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** Keys that come in a `.one` and an `.other` form. */
export type PluralKey = { [K in MessageKey]: K extends `${infer B}.one` ? B : never }[MessageKey];

/** A counted string, in the form the language's own plural rules pick for `count`; `{count}` is filled in. */
export function plural(lang: Lang, key: PluralKey, count: number, params: Params = {}): string {
  const form = new Intl.PluralRules(LOCALE[lang]).select(count) === ONE ? "one" : "other";
  return t(lang, `${key}.${form}`, { ...params, count });
}

/** "7:03 pm" in the owner's locale. */
export const timeText = (lang: Lang, at: Date): string =>
  at.toLocaleTimeString(LOCALE[lang], { hour: "numeric", minute: "2-digit" });

/** "28/10/2026" in the owner's locale. */
export const dateText = (lang: Lang, at: Date): string => at.toLocaleDateString(LOCALE[lang]);

/** A question the other side's agent asked, in this owner's language. */
export const questionText = (lang: Lang, key: QuestionKey): string => t(lang, `question.${key}`);
