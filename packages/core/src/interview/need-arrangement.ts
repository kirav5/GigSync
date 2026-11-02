import { Arrangement, hasArrangements, type Trade } from "@gigsync/protocol";
import { type MessageKey, t } from "../i18n/t.js";
import { EVERY_DAY } from "../job/when.js";
import type { Choice, Line, Prompt } from "./card.js";
import { moveOn, type NeedState } from "./need.js";
import type { NeedDraft } from "./need-types.js";

/**
 * Find's "how long" question (ADR 0046): for maid and driver work, a few hours, one visit, some days a week or every
 * month, asked after the trade and before the estimate, which is then given in that arrangement's unit.
 */

const A = Arrangement.enum;

/** The trade is one Find asks the arrangement for. */
export const arrangedTrade = (trade: Trade | undefined): trade is Trade =>
  trade !== undefined && hasArrangements(trade);

/** The arrangement is still to be asked. */
export const needsArrangement = (d: NeedDraft): boolean => arrangedTrade(d.trade) && d.arrangement === undefined;

const BUDGET_PER: Readonly<Record<Arrangement, MessageKey>> = {
  [A.hourly]: "need.budget_per.hour",
  [A.visit]: "need.budget_per.visit",
  [A.weekly]: "need.budget_per.week",
  [A.monthly]: "need.budget_per.month",
};

const CHOICES: readonly Choice[] = Arrangement.options.map((a) => ({ value: a, key: `need.arr.${a}` as const }));

/** Work that recurs, on every day it is due; hours or one visit are on one day, which the owner is asked. */
const RECURRING: ReadonlySet<Arrangement> = new Set([A.weekly, A.monthly]);

/** The words for each arrangement in English, Hindi and Kannada, checked longest stretch of time first. */
const SAID: readonly (readonly [Arrangement, RegExp])[] = [
  [A.monthly, /\b(?:month|monthly)\b|महीन|ಮಾಸಿಕ|ತಿಂಗಳ/i],
  [A.weekly, /\b(?:weekly|a week|per week|days? a week)\b|हफ़्त|हफ्त|ವಾರದಲ್ಲಿ|ವಾರಕ್ಕೆ/i],
  [A.visit, /\b(?:once|one[- ]?(?:time|off|visit))\b|एक बार|ಒಂದೇ ಸಲ|ಒಮ್ಮೆ|ಒಂದು ಸಲ/i],
  [A.hourly, /\b(?:hours?|hourly)\b|घंट|ಗಂಟೆ/i],
];

/** The arrangement a sentence names, if any. */
export const arrangementSaid = (text: string): Arrangement | undefined =>
  SAID.find(([, words]) => words.test(text))?.[0];

/** The draft with an arrangement: recurring work is every day unless the owner said a day; one-off work is not. */
export function withArrangement(d: NeedDraft, arrangement: Arrangement): NeedDraft {
  const day = RECURRING.has(arrangement) ? (d.day ?? EVERY_DAY) : d.day === EVERY_DAY ? undefined : d.day;
  return { ...d, arrangement, day };
}

export function arrangementPrompt(s: NeedState): Prompt {
  return {
    lines: [{ key: "need.ask.arrangement" }],
    choices: CHOICES,
    hints: CHOICES.map((c) => t(s.config.own, c.key)),
  };
}

/** A spoken or typed answer; undefined when it names no arrangement, so the question is asked again. */
export function hearArrangement(s: NeedState, text: string): NeedState | undefined {
  const said = arrangementSaid(text);
  return said ? moveOn(s, withArrangement(s.draft, said)) : undefined;
}

/** A chip tapped. */
export function chooseArrangement(s: NeedState, value: string): NeedState {
  const picked = Arrangement.safeParse(value).data;
  return picked ? moveOn(s, withArrangement(s.draft, picked)) : s;
}

/** The arrangement in the readback, when the trade has one. */
export const arrangementLines = (d: NeedDraft): Line[] =>
  d.arrangement && arrangedTrade(d.trade)
    ? [{ key: "need.summary_arrangement", names: { arrangement: [`arrangement.${d.arrangement}`] } }]
    : [];

/** Under the budget question: what the budget is for, an hour, the visit, a week or a month. */
export const budgetUnitLines = (d: NeedDraft): Line[] =>
  d.arrangement && arrangedTrade(d.trade) ? [{ key: BUDGET_PER[d.arrangement] }] : [];
