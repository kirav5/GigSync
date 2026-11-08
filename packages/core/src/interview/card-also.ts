import { GROUP_KINDS, groupOf, isTradeKind, type WorkKind } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { cardKinds, categoryPicked, kindKey, kindValue, toggleKind } from "../skills/kinds.js";
import { advance, type CardDraft, type InterviewState, Pick } from "./card.js";
import type { Prompt } from "./card-lines.js";
import { tradesIn } from "./lexicon.js";

/**
 * "Do you also do any of these?" (ADR 0061): once the worker named their work, the other kinds in its group, as chips to
 * tick, so a worker unsure what to list finds it without typing. A maid may tick laundry and ironing; a TV mechanic,
 * fridge repair. Skipped when the group has nothing else.
 */

/** The work the card is mainly about: its first trade, else the kind its first skill is filed under. */
const mainKind = (d: CardDraft): WorkKind | undefined => d.trades?.[0] ?? d.skills?.find((s) => s.category)?.category;

/** The other kinds in the main kind's group. */
export function alsoKinds(d: CardDraft): WorkKind[] {
  const main = mainKind(d);
  return main ? GROUP_KINDS[groupOf(main)].filter((k) => k !== main) : [];
}

export function alsoPrompt(s: InterviewState): Prompt {
  const kinds = alsoKinds(s.draft);
  const on = cardKinds(s.draft);
  return {
    lines: [{ key: "iv.ask.also" }],
    choices: [...kinds.map((k) => ({ value: kindValue(k), key: kindKey(k) })), { value: Pick.yes, key: "iv.done" }],
    picked: kinds.filter((k) => on.includes(k)).map(kindValue),
    hints: kinds.map((k) => t(s.config.own, kindKey(k))),
  };
}

const work = (d: CardDraft) => ({ trades: d.trades ?? [], skills: d.skills ?? [] });

/** A kind ticked or unticked; Done moves on. */
export function chooseAlso(s: InterviewState, value: string): InterviewState {
  if (value === Pick.yes) return advance(s, s.draft);
  const kind = isTradeKind(value) ? value : categoryPicked(value);
  if (!kind || !alsoKinds(s.draft).includes(kind)) return s;
  return { ...s, draft: { ...s.draft, ...toggleKind(s.config.own, work(s.draft), kind) }, notes: [], fresh: false };
}

/**
 * Words: trades named are added; anything else moves on as it is. The question is optional, so a voice answer it cannot
 * use never holds the card back: the worker can add work later on My card.
 */
export function hearAlso(s: InterviewState, text: string): InterviewState {
  const named = tradesIn(text).filter((tr) => alsoKinds(s.draft).includes(tr));
  const draft = named.reduce((d, tr) => ({ ...d, ...toggleKind(s.config.own, work(d), tr) }), s.draft);
  return advance(s, draft);
}
