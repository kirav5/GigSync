import type { Lang, QuestionKey } from "@gigsync/protocol";
import { en, type MessageKey, type Strings } from "./en.js";
import { hi } from "./hi.js";
import { kn } from "./kn.js";

/** Every language's strings. A new language is one file and one line here, plus its value in `Lang`. */
const STRINGS: Readonly<Record<Lang, Strings>> = { en, hi, kn };

const PLACEHOLDER = /\{(\w+)\}/g;

/** The string for `key` in `lang`, with `{name}` placeholders filled from `params` (left as is when not given). */
export function t(lang: Lang, key: MessageKey, params: Readonly<Record<string, string | number>> = {}): string {
  return STRINGS[lang][key].replace(PLACEHOLDER, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** A question the other side's agent asked, in this owner's language. */
export const questionText = (lang: Lang, key: QuestionKey): string => t(lang, `question.${key}`);

export type { MessageKey };
