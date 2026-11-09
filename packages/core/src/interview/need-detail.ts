import { DetailFlag, DriverKind, DriverName, driverSpec, QuestionKey } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { YES_NO_QUESTIONS } from "../job/details.js";
import type { Choice } from "./card.js";
import { draftDrivers } from "./driver-ask.js";
import { isSkip, yesNo } from "./lexicon.js";
import { firstQuestion, moveOn, type NeedDraft, type NeedState, workOf } from "./need.js";
import { DONT_KNOW, DriverPick, driverChoice } from "./need-drivers.js";
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
  const question = firstQuestion(workOf(s.draft));
  if (question && YES_NO_QUESTIONS.has(question)) {
    const yes = yesNo(text);
    return yes === undefined ? undefined : yes ? DetailFlag.enum.yes : DetailFlag.enum.no;
  }
  return isSkip(text) ? null : withoutMoney(text) || undefined;
}

/**
 * With no model reading, "What exactly isn't working?" cannot be answered in words: for the repair trades it is asked
 * as the kinds of problem the estimate knows (a fan, a leak, "Something else"), then "I don't know". Undefined for any
 * other question, and whenever words can be read.
 */
export function problemChoices(s: NeedState): Choice[] | undefined {
  const trade = s.draft.trade;
  const kind = DriverName.enum.problem;
  if (!s.chipsOnly || !trade || firstQuestion(trade) !== QuestionKey.enum.problem) return undefined;
  const spec = driverSpec(trade, kind);
  if (spec?.kind !== DriverKind.choice) return undefined;
  return [...spec.values.map((value) => driverChoice(s.config.own, kind, value)), DONT_KNOW];
}

/**
 * A tap on one of those: the kind of problem is the estimate's driver, and its name, as the owner read it, is the
 * answer the worker reads. "I don't know" is a skip. Undefined for a value the question did not offer.
 */
export function chooseProblem(s: NeedState, value: string): NeedState | undefined {
  const chip = problemChoices(s)?.find((c) => c.value === value);
  if (!chip) return undefined;
  const d = s.draft;
  if (value === DriverPick.dontKnow) return moveOn(s, settledProblem({ ...d, detail: null }));
  const problem = value.slice(DriverPick.set.length);
  return moveOn(s, { ...d, detail: t(s.config.own, chip.key, chip.params), drivers: { ...d.drivers, problem } });
}
