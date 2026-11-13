import { DriverName, QuestionKey } from "@gigsync/protocol";
import { firstQuestion, type NeedDraft, withTrade } from "./need.js";
import { withSaidArrangement } from "./need-arrangement.js";
import type { NeedHint } from "./need-model.js";
import type { NeedFill } from "./need-parse.js";
import { withScopeRead } from "./need-scope.js";
import { tradeTitled } from "./trade-titled.js";

/** Filling a need's draft from what an answer said besides the question it answered: the words lists', then a model's. */

/** The sentence's other answers, each only where nothing was given yet. */
export function fillEmpty(d: NeedDraft, fill: NeedFill): NeedDraft {
  const seen = { ...fill.details, ...d.seen };
  // The day said comes before the work: monthly work is every day only when the owner named no day (`withTrade`).
  let next: NeedDraft = { ...d, seen, day: d.day ?? fill.day };
  const first = firstQuestion(next.trade);
  if (first && next.detail === undefined && seen[first]) next = { ...next, detail: seen[first] };
  // Work already found as a kind or as no listed work stays so: a later answer's word is no reason to make it a trade.
  if (fill.trade && !next.trade && !next.skill && !next.jobType) next = withTrade(next, fill.trade);
  next = withSaidArrangement(next, fill.arrangement);
  return {
    ...next,
    area: next.area ?? fill.area,
    day: next.day ?? fill.day,
    time: next.time ?? fill.time,
    budget_paise: next.budget_paise ?? fill.budget_paise,
  };
}

/** A model's reading, only where the words lists found nothing (`understandNeed` has checked every value). */
export function fillFromHint(d: NeedDraft, hint: NeedHint, words: string): NeedDraft {
  const problem = QuestionKey.enum.problem;
  const seen = hint.problem && words && !d.seen[problem] ? { ...d.seen, [problem]: words } : d.seen;
  const kind = DriverName.enum.problem;
  const drivers =
    hint.problemKind && d.drivers?.[kind] === undefined ? { ...d.drivers, [kind]: hint.problemKind } : d.drivers;
  const next = withScopeRead({ ...d, seen, drivers, fits: d.fits ?? hint.fits }, hint.scope);
  return fillEmpty(next, { ...hint, details: {}, words });
}

/** Words whose work was decided already: the trade and the arrangement are the reading's, never the lists'. */
export function decidedFill({ trade: _lists, ...parsed }: NeedFill, hint: NeedHint): NeedFill {
  return {
    ...parsed,
    ...(hint.trade ? { trade: hint.trade } : {}),
    ...(hint.arrangement ? { arrangement: hint.arrangement } : {}),
  };
}

/**
 * The values a sentence at the readback changes: "make it tomorrow", "Koramangala instead". The work changes only when
 * a trade is named outright: "make it Saturday, the plumber can come" is no new trade, and other work goes to the
 * model, which offers to switch.
 */
export function changedBy(d: NeedDraft, fill: NeedFill, text: string): NeedDraft | undefined {
  const trade = tradeTitled(text);
  const next: NeedDraft = {
    ...(trade ? withTrade(d, trade) : d),
    ...(fill.area ? { area: fill.area } : {}),
    // A new day said alone keeps the hour already given; the hour is asked only when there is none.
    ...(fill.day ? { day: fill.day, time: fill.time ?? d.time } : fill.time ? { time: fill.time } : {}),
    ...(fill.budget_paise ? { budget_paise: fill.budget_paise } : {}),
  };
  const same = (Object.keys(next) as (keyof NeedDraft)[]).every((k) => next[k] === d[k]);
  return same ? undefined : next;
}
