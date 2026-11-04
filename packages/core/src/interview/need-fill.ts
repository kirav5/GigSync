import { DriverName, QuestionKey } from "@gigsync/protocol";
import { firstQuestion, type NeedDraft, withTrade } from "./need.js";
import { withSaidArrangement } from "./need-arrangement.js";
import type { NeedHint } from "./need-model.js";
import type { NeedFill } from "./need-parse.js";
import { withScopeRead } from "./need-scope.js";

/** Filling a need's draft from what an answer said besides the question it answered: the words lists', then a model's. */

/** The sentence's other answers, each only where nothing was given yet. */
export function fillEmpty(d: NeedDraft, fill: NeedFill): NeedDraft {
  const seen = { ...fill.details, ...d.seen };
  let next: NeedDraft = { ...d, seen };
  const first = firstQuestion(next.trade);
  if (first && next.detail === undefined && seen[first]) next = { ...next, detail: seen[first] };
  if (fill.trade && !next.trade) next = withTrade(next, fill.trade);
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
