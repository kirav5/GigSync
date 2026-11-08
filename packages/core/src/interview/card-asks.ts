import { advance, type CardDraft, type InterviewState, type Line, Pick, type Prompt } from "./card.js";
import { isSkip } from "./lexicon.js";

/**
 * What the worker needs to know before quoting, in their own words (ADR 0063): "which floor, is there a lift, brand of
 * the fridge". Their agent's model asks the household these first, worded for each job, and leaves out any that do
 * not fit. Private: it stays on the phone, and nothing in it is shown to a household as written.
 */

/** At most this many: the model asks three questions at most, so a longer list only dilutes it. */
export const ASKS_MAX = 5;
/** One thing to know, not a paragraph. */
const ASK_CHARS_MAX = 120;
const ASK_CHARS_MIN = 3;
/** Where one thing to know ends and the next begins, as people say or type a list. */
const BETWEEN = /[?？\n;,।|]+/u;

/** The things to know in what the worker said; empty when nothing usable. */
export const asksIn = (text: string): string[] =>
  text
    .split(BETWEEN)
    .map((part) => part.trim())
    .filter((part) => part.length >= ASK_CHARS_MIN && part.length <= ASK_CHARS_MAX)
    .slice(0, ASKS_MAX);

export const asksPrompt = (): Prompt => ({
  lines: [{ key: "iv.ask.asks" }],
  choices: [{ value: Pick.skip, key: "iv.skip" }],
  hints: [],
});

/** Words: the list said, kept and read back; skip, or nothing usable, leaves the agent to ask from the job alone. */
export function hearAsks(s: InterviewState, text: string): InterviewState {
  const { asks: _old, ...rest } = s.draft;
  const asks = isSkip(text) ? [] : asksIn(text);
  if (asks.length === 0) return advance(s, rest);
  return advance(s, { ...rest, asks }, [{ key: "iv.got_asks", params: { list: asks.join(", ") } }]);
}

export const chooseAsks = (s: InterviewState, value: string): InterviewState =>
  value === Pick.skip ? hearAsks(s, value) : s;

/** The list in the summary, once the worker gave one. */
export const asksSummary = (d: CardDraft): Line[] =>
  d.asks?.length ? [{ key: "iv.summary_asks", params: { list: d.asks.join(", ") } }] : [];
