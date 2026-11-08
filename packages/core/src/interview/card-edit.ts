import { type Arrangement, TermKey, TRADE_TERMS } from "@gigsync/protocol";
import { parseAmount, statedNumbers } from "./amount.js";
import { arrangementSaid, arrangementsSaid } from "./arrangement-words.js";
import { advance, askable, FIELDS, type InterviewState, openSlot, type Prompt, retry, Slot } from "./card.js";
import { arranged, arrangementRates, cardArrangements, mainOf } from "./card-arrangements.js";
import { hear } from "./card-parse.js";
import { anyHoursSaid, daysSaid, hoursSaid } from "./card-words.js";
import { asksWorkRates } from "./card-work-list.js";
import { YES_NO } from "./choices.js";
import { areaNamedIn, type Field, languagesIn, tradesIn } from "./lexicon.js";

/**
 * Changing one field of a whole card (ADR 0053 §7): which fields this card has, the question for it, and a value said
 * with the change ("change my rate to 500"), which answers that question at once. The answer is read back or checked
 * as any other, and nothing reaches the board until the owner says yes to the summary.
 */

/** Two unclear answers to taking the card off the board count as no: it stays on. */
const UNCLEAR_LIMIT = 2;

const pricedRates = (s: InterviewState): Arrangement[] => arrangementRates(s.draft).map((r) => r.arrangement);

/** The fields this card can change: only what fits its work, and taking it off the board only while it is on. */
export function fieldsFor(s: InterviewState): Field[] {
  const trades = s.draft.trades ?? [];
  const negotiates = (key: TermKey) => trades.some((tr) => TRADE_TERMS[tr].includes(key));
  const fits: Partial<Record<Field, boolean>> = {
    [Slot.arrangements]: arranged(s.draft),
    [Slot.ask_first]: askable(trades).length > 0,
    [Slot.materials]: negotiates(TermKey.enum.materials),
    [Slot.max_hours]: negotiates(TermKey.enum.hours),
    [Slot.unlist]: !s.offBoard,
    [Slot.same_rate]: asksWorkRates(s.draft),
  };
  return FIELDS.filter((f) => fits[f] !== false);
}

/**
 * Jumps to one field; after it is answered the interview returns to confirm. With several rates it first asks which;
 * a field this card does not have goes back to the summary.
 */
export function edit(s: InterviewState, slot: Slot): InterviewState {
  if (FIELDS.some((f) => f === slot) && !fieldsFor(s).some((f) => f === slot)) return openSlot(s, Slot.confirm);
  return openSlot(s, slot === Slot.rate && pricedRates(s).length > 1 ? Slot.which_rate : slot);
}

/** The words hold a value for the field, not only its name. */
const CARRIES: Partial<Record<Field, (text: string, s: InterviewState) => boolean>> = {
  [Slot.trade]: (text) => tradesIn(text).length > 0,
  [Slot.arrangements]: (text, s) => arrangementsSaid(text).some((a) => cardArrangements(s.draft).includes(a)),
  [Slot.area]: (text, s) => areaNamedIn(text, s.config.areas) !== undefined,
  [Slot.radius]: (text) => statedNumbers(text).length > 0,
  [Slot.rate]: (text) => parseAmount(text) !== undefined,
  [Slot.min]: (text) => parseAmount(text) !== undefined,
  [Slot.hours]: (text) => anyHoursSaid(text) || hoursSaid(text) !== undefined,
  [Slot.days]: (text) => daysSaid(text) !== undefined,
  [Slot.languages]: (text) => languagesIn(text).length > 0,
  [Slot.max_hours]: (text) => statedNumbers(text).length > 0,
};

/** On to the rate for one arrangement, and to the amount if the owner already said it. */
function pickRate(s: InterviewState, a: Arrangement): InterviewState {
  const main = a === mainOf(s.draft);
  const picked = {
    ...s,
    slot: main ? Slot.rate : Slot.more_rates,
    rateFor: main ? undefined : a,
    notes: [],
    heard: undefined,
  };
  return s.heard ? hear(picked, s.heard) : picked;
}

/** Which rate to change: a chip for each, and any amount said with the change stays for the one picked. */
export const whichRatePrompt = (s: InterviewState): Prompt => ({
  lines: [{ key: "iv.ask.which_rate" }],
  choices: pricedRates(s).map((a) => ({ value: a, key: `arrangement.${a}` as const })),
  hints: [],
});

export function hearWhichRate(s: InterviewState, text: string): InterviewState {
  const a = arrangementSaid(text);
  return a && pricedRates(s).includes(a) ? pickRate(s, a) : retry(s, { key: "iv.again.which_rate" });
}

export function chooseWhichRate(s: InterviewState, value: string): InterviewState {
  const a = pricedRates(s).find((r) => r === value);
  return a ? pickRate(s, a) : s;
}

/**
 * The field the owner asked to change, in the words they asked with: when they name a value too, it answers the
 * question at once; a rate names the arrangement it is for ("change my hourly rate to 300").
 */
export function editSaid(s: InterviewState, field: Field, text: string, aloud = false): InterviewState {
  const opened = edit(s, field);
  const amount = parseAmount(text) !== undefined;
  if (opened.slot === Slot.which_rate) {
    const a = arrangementsSaid(text).find((r) => pricedRates(s).includes(r));
    const kept = amount ? { ...opened, heard: text } : opened;
    return a ? pickRate(kept, a) : kept;
  }
  return opened.slot === field && CARRIES[field]?.(text, opened) ? hear(opened, text, aloud) : opened;
}

export const unlistPrompt = (): Prompt => ({ lines: [{ key: "iv.ask.unlist" }], choices: YES_NO, hints: [] });

/** Yes goes on to take the card off; a no, or two unclear answers, leaves it where it is. */
export function onUnlist(s: InterviewState, yes: boolean | undefined): InterviewState {
  if (yes === true) return { ...s, slot: Slot.unlisted, notes: [], fresh: false };
  if (yes === undefined && s.misses + 1 < UNCLEAR_LIMIT)
    return { ...retry(s, { key: "iv.again.yes_no" }), misses: s.misses + 1 };
  return advance(s, s.draft);
}
