import type { Lang } from "@gigsync/protocol";
import { en } from "../i18n/en/index.js";
import type { MessageKey } from "../i18n/t.js";
import { type AreaChoice, type Choice, Pick } from "./card.js";

/** The tap choices and recognizer hints both interviews offer: yes or no, and the pilot's areas. */

export const YES_NO: readonly Choice[] = [
  { value: Pick.yes, key: "flag.yes" },
  { value: Pick.no, key: "flag.no" },
];

/** Which script a language's recognizer expects its words in, to pick area names worth biasing it towards. */
const SCRIPT: Readonly<Record<Lang, RegExp>> = {
  en: /\p{Script=Latin}/u,
  hi: /\p{Script=Devanagari}/u,
  kn: /\p{Script=Kannada}/u,
};

export const isMessageKey = (key: string): key is MessageKey => key in en;

/** A chip for each area the catalog names. */
/** A line of a name given as data, not from the catalog. */
const AREA_NAME = "estimate.answer";

export const areaChoices = (areas: readonly AreaChoice[], own?: Lang): Choice[] =>
  areas.flatMap((a): Choice[] => {
    const key = `area.${a.key}`;
    if (isMessageKey(key)) return [{ value: a.key, key }];
    // An area added in the directory (ADR 0061): its own name, in the owner's language.
    const name = own && a.label?.[own];
    return name ? [{ value: a.key, key: AREA_NAME, params: { text: name } }] : [];
  });

/** The areas' names written in the owner's script, for the recognizer. */
export const areaHints = (areas: readonly AreaChoice[], own: Lang): string[] =>
  areas.flatMap((a) => a.names.filter((n) => SCRIPT[own].test(n)));
