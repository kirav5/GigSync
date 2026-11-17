import {
  Arrangement,
  arrangementsOf,
  hasArrangements,
  isTrade,
  type JobTrade,
  ONE_OFF_ARRANGEMENTS,
  oneOffWork,
  Trade,
} from "@gigsync/protocol";
import { type MessageKey, t } from "../i18n/t.js";
import { EVERY_DAY } from "../job/when.js";
import { arrangementSaid } from "./arrangement-words.js";
import type { Choice, Line, Prompt } from "./card.js";
import { moveOn, type NeedState, workOf } from "./need.js";
import type { NeedDraft } from "./need-types.js";

/**
 * Find's "how long" question (ADR 0046), asked by the job's nature (ADR 0051): a few hours, one visit, some days a week
 * or every month, offering only what fits the work. A repair is one visit and never asked; a cook comes for one meal,
 * some days a week or every month; work outside the trades may be any, narrowed by the phone's model when it has one.
 * Asked after the trade and before the estimate, which is then given in that arrangement's unit.
 */

const A = Arrangement.enum;

/** More than one arrangement fits the work, so the owner is asked which. */
export const arrangedWork = (d: Pick<NeedDraft, "trade" | "skill">): boolean => {
  const work = workOf(d);
  return work !== undefined && hasArrangements(work);
};

/**
 * The arrangement a board search filters by, for any work taken more than one way: a worker whose card names other
 * ways only is not listed, as their assistant would decline at once. A card of a skill that names no way at all still
 * is (the board's search keeps those): it takes any, as such cards always have.
 */
export const boardArrangement = (d: NeedDraft): Arrangement | undefined =>
  arrangedWork(d) ? d.arrangement : undefined;

/** The arrangement is still to be asked. */
export const needsArrangement = (d: NeedDraft): boolean => arrangedWork(d) && d.arrangement === undefined;

/**
 * The arrangements offered as chips: the work's by its nature. For work outside the trades the model's reading of the
 * job narrows them (a nanny by the hour or the month, a photographer once); a trade's are reviewed data it never
 * overrides. Words may still name any arrangement the work allows.
 */
export function offeredArrangements(d: NeedDraft): readonly Arrangement[] {
  const work = workOf(d);
  if (!work) return [];
  const nature = arrangementsOf(work);
  const narrowed = isTrade(work) ? [] : nature.filter((a) => d.fits?.includes(a));
  return narrowed.length > 0 ? narrowed : nature;
}

/** The work is done on one day: an hour or a visit asked for, or work that is one visit by its nature. */
export function oneOffNeed(d: NeedDraft): boolean {
  if (d.arrangement !== undefined) return ONE_OFF_ARRANGEMENTS.has(d.arrangement);
  const work = workOf(d);
  return work !== undefined && oneOffWork(work);
}

const BUDGET_PER: Readonly<Record<Arrangement, MessageKey>> = {
  [A.hourly]: "need.budget_per.hour",
  [A.visit]: "need.budget_per.visit",
  [A.weekly]: "need.budget_per.week",
  [A.monthly]: "need.budget_per.month",
};

/** A chip worded for the work where the plain one would not fit: a cook comes once for a meal, not a "visit". */
const CHIP_FOR: Readonly<Partial<Record<JobTrade, Partial<Record<Arrangement, MessageKey>>>>> = {
  [Trade.enum.cook]: { [A.visit]: "need.arr.meal" },
};

const chipKey = (work: JobTrade | undefined, a: Arrangement): MessageKey =>
  (work && CHIP_FOR[work]?.[a]) ?? `need.arr.${a}`;

/** Work that recurs, on every day it is due; hours or one visit are on one day, which the owner is asked. */
const RECURRING: ReadonlySet<Arrangement> = new Set([A.weekly, A.monthly]);

/** The draft with an arrangement: recurring work is every day unless the owner said a day; one-off work is not. */
export function withArrangement(d: NeedDraft, arrangement: Arrangement): NeedDraft {
  const day = RECURRING.has(arrangement) ? (d.day ?? EVERY_DAY) : d.day === EVERY_DAY ? undefined : d.day;
  return { ...d, arrangement, day };
}

/** An arrangement the work allows, or undefined: a cook is never hired by the hour. */
function allowed(d: NeedDraft, a: Arrangement | undefined): Arrangement | undefined {
  const work = workOf(d);
  return a !== undefined && work !== undefined && arrangementsOf(work).includes(a) ? a : undefined;
}

/**
 * The arrangement the owner's words named before it was asked ("a maid for 3 hours on Saturday"), kept when the work
 * allows it, so the question is never asked of what was already said; the readback shows it either way.
 */
export function withSaidArrangement(d: NeedDraft, said: Arrangement | undefined): NeedDraft {
  const fits = needsArrangement(d) ? allowed(d, said) : undefined;
  return fits ? withArrangement(d, fits) : d;
}

export function arrangementPrompt(s: NeedState): Prompt {
  const work = workOf(s.draft);
  const choices: Choice[] = offeredArrangements(s.draft).map((a) => ({ value: a, key: chipKey(work, a) }));
  return {
    lines: [{ key: "need.ask.arrangement" }],
    choices,
    hints: choices.map((c) => t(s.config.own, c.key)),
  };
}

/** A spoken or typed answer; undefined when it names no arrangement the work allows, so the question is asked again. */
export function hearArrangement(s: NeedState, text: string): NeedState | undefined {
  const said = allowed(s.draft, arrangementSaid(text));
  return said ? moveOn(s, withArrangement(s.draft, said)) : undefined;
}

/** A chip tapped; one the work does not allow changes nothing. */
export function chooseArrangement(s: NeedState, value: string): NeedState {
  const picked = allowed(s.draft, Arrangement.safeParse(value).data);
  return picked ? moveOn(s, withArrangement(s.draft, picked)) : s;
}

/** The arrangement in the readback, when the work has one. */
export const arrangementLines = (d: NeedDraft): Line[] =>
  d.arrangement && arrangedWork(d)
    ? [{ key: "need.summary_arrangement", names: { arrangement: [`arrangement.${d.arrangement}`] } }]
    : [];

/** Under the budget question: what the budget is for, an hour, the visit, a week or a month. */
export const budgetUnitLines = (d: NeedDraft): Line[] =>
  d.arrangement && arrangedWork(d) ? [{ key: BUDGET_PER[d.arrangement] }] : [];
