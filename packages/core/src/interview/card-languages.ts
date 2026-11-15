import { Lang } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { type InterviewState, Pick, type Prompt } from "./card.js";

/**
 * "Besides English, which languages do you speak?": a chip for each other language, ticked on and off where it stands,
 * Done to answer with the ones ticked, and No other language, which answers at once with none. Naming them in words
 * still answers in one go (`card-parse.ts`).
 */

/** The other languages ticked so far: the draft's, less the owner's own, which a card always has first. */
export const languagesPicked = (s: InterviewState): Lang[] =>
  (s.draft.languages ?? []).filter((l) => l !== s.config.own);

export function languagesPrompt(s: InterviewState): Prompt {
  const { own } = s.config;
  return {
    lines: [{ key: "iv.ask.languages", names: { lang: [`lang.${own}`] } }],
    picked: languagesPicked(s),
    choices: [
      ...Lang.options.filter((l) => l !== own).map((l) => ({ value: l, key: `lang.${l}` as const })),
      { value: Pick.none, key: "iv.none" },
      { value: Pick.yes, key: "iv.done" },
    ],
    hints: Lang.options.map((l) => t(own, `lang.${l}`)),
  };
}

/** A language ticked or unticked; the question stays open, the card's languages in the order the chips list them. */
export function toggleLanguage(s: InterviewState, lang: Lang): InterviewState {
  const picked = languagesPicked(s);
  const next = picked.includes(lang) ? picked.filter((l) => l !== lang) : [...picked, lang];
  const others = Lang.options.filter((l) => l !== s.config.own && next.includes(l));
  return { ...s, draft: { ...s.draft, languages: [s.config.own, ...others] }, notes: [], fresh: false };
}
