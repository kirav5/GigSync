import { DriverKind, driverSpec, QuestionKey } from "@gigsync/protocol";
import { awaitingModel, currentQuestion } from "./driver-ask.js";
import { askingFirst } from "./first-question.js";
import { firstQuestion, moveOn, NeedSlot, type NeedState, offered, workOf } from "./need.js";
import { needPrompt } from "./need-prompt.js";

/**
 * How a question in Find may be answered, given whether a model can read words right now. Since ADR 0064 the word
 * lists never guess what a sentence means, so with no model reading (GigSync's model down or paused, none on the
 * phone, or lite mode chosen) a sentence is not offered at all: the chat serves with its chips. A number is not a
 * sentence: code reads it, so the budget and the counts keep a number field beside their chips.
 */
export const NeedInput = {
  /** A model reads: words, typed or said, and the chips. */
  words: "words",
  /** No model reads, and the answer is a number: a number field, and the chips. */
  number: "number",
  /** No model reads: the chips alone. */
  chips: "chips",
} as const;
export type NeedInput = (typeof NeedInput)[keyof typeof NeedInput];

/** A price question that fills a fixed driver, as `PriceFill` names it. */
const Fill = { driver: "driver" } as const;
const Q = QuestionKey.enum;
/** The clarifying questions answered with a count ("How many rooms?"); the others want a description in words. */
const COUNT_DETAILS: ReadonlySet<QuestionKey> = new Set([Q.rooms, Q.people, Q.meals, Q.hours]);

/** The clarifying question now asked wants a count. */
function countDetail(s: NeedState): boolean {
  const first = firstQuestion(workOf(s.draft));
  return first !== undefined && COUNT_DETAILS.has(first);
}

/** The price question now asked is a fixed driver that holds a count (rooms, square feet), not one of a few values. */
function countDriver(s: NeedState): boolean {
  const q = currentQuestion(s.draft);
  const trade = s.draft.trade;
  if (!q || !trade || !(Fill.driver in q.fills)) return false;
  return driverSpec(trade, q.fills.driver)?.kind === DriverKind.count;
}

/** Nothing is asked of the owner now: a search, the workers found, or a model wording the next question. */
const nothingAsked = (s: NeedState): boolean =>
  s.slot === NeedSlot.done || s.slot === NeedSlot.found || awaitingModel(s.draft) || askingFirst(s);

/** What the question takes when no model reads, by what it asks. */
function withoutModel(s: NeedState): NeedInput {
  if (s.switching || offered(s)) return NeedInput.chips;
  switch (s.slot) {
    case NeedSlot.budget:
      return NeedInput.number;
    case NeedSlot.detail:
      return countDetail(s) ? NeedInput.number : NeedInput.chips;
    case NeedSlot.driver:
      return countDriver(s) ? NeedInput.number : NeedInput.chips;
    default:
      return NeedInput.chips;
  }
}

/**
 * What the question now asked takes: `reads` is whether a model can read words right now. A question left with no
 * chip and no number to give still takes words, so the chat never stands at a question nothing can answer.
 */
export function needInput(s: NeedState, reads: boolean): NeedInput {
  if (reads) return NeedInput.words;
  if (nothingAsked(s)) return NeedInput.chips;
  const input = withoutModel(s);
  const chips = needPrompt(s).choices ?? [];
  return input === NeedInput.chips && chips.length === 0 ? NeedInput.words : input;
}

/**
 * The need as it stands when no model reads: marked so, which makes its questions ask in chips (the repair trades'
 * "what is wrong?" as the kinds of problem, `need-detail.ts`). The opening invites the whole need in the owner's
 * words, which nothing could read: it shows the list instead (the groups, then the kinds in one). Addressed to a
 * worker whose work is already set, there is nothing to pick, so it goes to the first question still open. Calling
 * this again changes nothing.
 */
export function chipsOnlyNeed(s: NeedState): NeedState {
  const marked: NeedState = s.chipsOnly ? s : { ...s, chipsOnly: true };
  if (marked.slot !== NeedSlot.trade || marked.switching) return marked;
  if (marked.to && workOf(marked.draft) !== undefined) return moveOn(marked, marked.draft);
  return marked.fresh ? { ...marked, fresh: false, notes: [] } : marked;
}

/** A model reads again: the questions from here on are asked as usual. Calling this again changes nothing. */
export const typingNeed = (s: NeedState): NeedState => (s.chipsOnly ? { ...s, chipsOnly: false } : s);
