import { type Estimate, type JobTrade, type Lang, type Place, QuestionKey, type Skill } from "@gigsync/protocol";
import { driversToDetails } from "../estimate/driver-details.js";
import { t } from "../i18n/t.js";
import { YES_NO_QUESTIONS } from "../job/details.js";
import type { NewNeed } from "../job/device.js";
import { localDay, WhenDetail } from "../job/when.js";
import { DayWord, firstQuestion, type NeedDraft, workOf } from "./need.js";
import { scopeDetails } from "./need-scope.js";

/**
 * The request a household sends, built the same way whether they filled in Find's form or said it in the chat: the
 * owner's words, the day as a date each phone can file, the detail the worker's agent would ask, and the budget as a
 * private mandate that never leaves the phone.
 */

/**
 * The opening the old fixed curve used, as a share of the budget. Each request now opens at a share drawn at random
 * when its first quote arrives (job/household-plan.ts, ADR 0033); this stays on the need so it is a whole mandate.
 */
export const OPENING_SHARE = 0.7;
/** How many workers one need may ask at once. */
export const MAX_ASK = 3;
const MS_PER_DAY = 86_400_000;

export interface NeedParts {
  /** A trade, or `other` with the listed `skill` the household asked for (ADR 0047). */
  trade: JobTrade;
  skill?: Skill | undefined;
  need: string;
  /** An ISO day or `EVERY_DAY` (`resolveDay`). */
  day: string;
  /** The day as the owner reads it: the date itself, or "Every day". Never "Today": that is true only today. */
  label: string;
  time?: string | undefined;
  /** Answers given up front, by question key. */
  details?: Readonly<Record<string, string>>;
  budget_paise: number;
  /** The area's point; only its coarse rounding is ever sent (ADR 0045). */
  area: Place;
  /** The locality's name, shown to workers before signing. */
  locality?: string | undefined;
  /** The saved address as one line, for the worker once both have signed. */
  site?: string | undefined;
  /** The estimate for the whole job the owner saw beside the budget, if any; it stays on this phone. */
  estimate?: Estimate | undefined;
  /** The terms the owner asked for and what they are flexible about (`needTerms`); their agent negotiates them. */
  terms?: Pick<NewNeed, "terms" | "flexible">;
}

/** The request for `device.request`. Older phones and the agent read `when`; it becomes the signed slot. */
export function needToSend(p: NeedParts): NewNeed {
  return {
    trade: p.trade,
    ...(p.skill ? { skill: p.skill } : {}),
    need: p.need,
    when: p.time ? `${p.label} ${p.time}` : p.label,
    area: { lat: p.area.lat, lon: p.area.lon },
    ...(p.locality ? { locality: p.locality } : {}),
    ...(p.site ? { site: p.site } : {}),
    details: {
      ...p.details,
      [WhenDetail.day]: p.day,
      ...(p.time ? { [WhenDetail.time]: p.time } : {}),
    },
    budget: { opening_paise: Math.round(p.budget_paise * OPENING_SHARE), limit_paise: p.budget_paise },
    ...(p.estimate ? { estimate: p.estimate } : {}),
    ...p.terms,
  };
}

/**
 * A day word as the phone's calendar day, `offsetMinutes` ahead of UTC, at `now`; `EVERY_DAY` and dates stay as they
 * are. Resolved when the request is sent, so "tomorrow" said before midnight is still tomorrow.
 */
export function resolveDay(day: string, now: Date, offsetMinutes: number): string {
  if (day === DayWord.today) return localDay(now, offsetMinutes);
  if (day === DayWord.tomorrow) return localDay(new Date(now.getTime() + MS_PER_DAY), offsetMinutes);
  return day;
}

/**
 * The details the chat gathered, by question key: the price drivers read or answered (ADR 0041), the scope chips the
 * owner confirmed, and the first question's answer.
 */
export function draftDetails(d: NeedDraft): Record<string, string> {
  const first = firstQuestion(workOf(d));
  const drivers = d.trade && d.drivers ? driversToDetails(d.trade, d.drivers) : {};
  const arrangement = d.arrangement ? { [QuestionKey.enum.arrangement]: d.arrangement } : {};
  return { ...drivers, ...scopeDetails(d), ...(first && d.detail ? { [first]: d.detail } : {}), ...arrangement };
}

/** An answer that is only a number in any script ("4", "४", "೪"): a count, which says nothing as the job's words. */
export const NUMBER_ONLY = /^\p{Nd}+$/u;

/**
 * The words the workers read: the owner's own, else their answer about the problem, else the trade's name in their
 * language (a need tapped together from chips has no other words). A count ("how many people? 4") is not words: shown
 * alone on the card it read as a bare "4".
 */
export function needWords(d: NeedDraft, own: Lang): string {
  // A listed skill's name heads the request; the owner's words about the work are its first answer (ADR 0047).
  if (d.skill) return d.skill.text;
  const first = firstQuestion(d.trade);
  const answer = first && !YES_NO_QUESTIONS.has(first) ? d.detail?.trim() : undefined;
  const detail = answer && !NUMBER_ONLY.test(answer) ? answer : undefined;
  return d.need?.trim() || detail || (d.trade ? t(own, `trade.${d.trade}`) : "");
}
