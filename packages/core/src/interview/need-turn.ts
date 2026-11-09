import { t } from "../i18n/t.js";
import type { WorkPick } from "../skills/work-list.js";
import { NeedSlot, type NeedState } from "./need.js";
import type { NeedHint } from "./need-model.js";
import { NOT_HEARD } from "./need-say.js";
import type { TurnContext, TurnRead } from "./read-turn.js";

/**
 * Between one message's read (`read-turn.ts`) and the interview: what the model is told about the need, and what its
 * read becomes. Only what the owner said reaches it: the need's words and the questions answered, never a secret answer
 * (the budget is not a model question, and it is asked after these).
 */

/** The work the need is about, as the owner would say it. */
function workOfNeed(s: NeedState): string | undefined {
  const { trade, skill, jobType } = s.draft;
  if (trade) return t(s.config.own, `trade.${trade}`);
  return skill?.text ?? jobType;
}

/** The chat so far, as far as the need has it. */
function chatSoFar(s: NeedState): string[] {
  const { need, detail, modelAsk } = s.draft;
  const said = typeof detail === "string" && detail !== need ? [detail] : [];
  return [...(need ? [need] : []), ...said, ...(modelAsk?.said ?? []).map((qa) => `${qa.q} ${qa.a}`)];
}

export const turnContext = (
  s: NeedState,
  text: string,
  options: readonly WorkPick[],
  question?: string,
): TurnContext => ({
  lang: s.config.own,
  text,
  options,
  work: workOfNeed(s),
  question,
  recent: chatSoFar(s),
});

/** The read as the interview's hint: the model's trade and how the work is hired, which the word lists never override. */
export const hintOf = (read: TurnRead): NeedHint => ({
  decided: true,
  ...(read.trade ? { trade: read.trade } : {}),
  ...(read.problem ? { problem: true as const } : {}),
  ...(read.arrangement ? { arrangement: read.arrangement } : {}),
});

/**
 * The message may be about other work: the lists could not use it, or the question takes any words, where "my tv is
 * broken too" would pass as an answer. Secret answers never reach this.
 */
export const worthReading = (s: NeedState, heard: NeedState): boolean =>
  notHeard(heard) || s.slot === NeedSlot.driver || s.slot === NeedSlot.detail;

/** The answer was not understood: the interview would say so and ask again. */
export const notHeard = (s: NeedState): boolean => s.notes.some((n) => NOT_HEARD.includes(n.key));
