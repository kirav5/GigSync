import { DetailFlag, DriverName, QuestionKey } from "@gigsync/protocol";
import { YES_NO_QUESTIONS } from "../job/details.js";
import { draftDrivers } from "./driver-ask.js";
import { isSkip, yesNo } from "./lexicon.js";
import { firstQuestion, type NeedDraft, type NeedState } from "./need.js";
import { withoutMoney } from "./need-parse.js";

/**
 * The trade's clarifying question in the need interview ("What exactly isn't working?", "How many rooms?"): how its
 * answer is read, and what answering it settles about the price questions (ADR 0041, ADR 0042).
 */

/**
 * The clarifying question was answered, in words or by a skip: a problem driver its answer did not fill is not asked
 * again as a price question. The owner said what is wrong in their own words, which the worker reads; the estimate
 * assumes the kind and says so.
 */
export function settledProblem(d: NeedDraft): NeedDraft {
  const kind = DriverName.enum.problem;
  if (!d.trade || firstQuestion(d.trade) !== QuestionKey.enum.problem) return d;
  if (draftDrivers(d)[kind] !== undefined || (d.notKnown ?? []).includes(kind)) return d;
  return { ...d, notKnown: [...(d.notKnown ?? []), kind] };
}

/** The answer to the trade's first question: a yes or no for a yes-or-no question, else the owner's words. */
export function detailAnswer(s: NeedState, text: string): string | null | undefined {
  const question = firstQuestion(s.draft.trade);
  if (question && YES_NO_QUESTIONS.has(question)) {
    const yes = yesNo(text);
    return yes === undefined ? undefined : yes ? DetailFlag.enum.yes : DetailFlag.enum.no;
  }
  return isSkip(text) ? null : withoutMoney(text) || undefined;
}
