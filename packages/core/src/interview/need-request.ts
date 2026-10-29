import type { Lang, Place, Trade } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { YES_NO_QUESTIONS } from "../job/details.js";
import type { NewNeed } from "../job/device.js";
import { localDay, WhenDetail } from "../job/when.js";
import { DayWord, firstQuestion, type NeedDraft } from "./need.js";

/**
 * The request a household sends, built the same way whether they filled in Find's form or said it in the chat: the
 * owner's words, the day as a date each phone can file, the detail the worker's agent would ask, and the budget as a
 * private mandate that never leaves the phone.
 */

/** The consumer's agent opens at this share of their budget and concedes toward the full budget. */
export const OPENING_SHARE = 0.7;
/** How many workers one need may ask at once. */
export const MAX_ASK = 3;
const MS_PER_DAY = 86_400_000;

export interface NeedParts {
  trade: Trade;
  need: string;
  /** An ISO day or `EVERY_DAY` (`resolveDay`). */
  day: string;
  /** The day as the owner reads it: the date itself, or "Every day". Never "Today": that is true only today. */
  label: string;
  time?: string | undefined;
  /** Answers given up front, by question key. */
  details?: Readonly<Record<string, string>>;
  budget_paise: number;
  /** The area's centre: the only point ever shared. */
  area: Place;
}

/** The request for `device.request`. Older phones and the agent read `when`; it becomes the signed slot. */
export function needToSend(p: NeedParts): NewNeed {
  return {
    trade: p.trade,
    need: p.need,
    when: p.time ? `${p.label} ${p.time}` : p.label,
    area: { lat: p.area.lat, lon: p.area.lon },
    details: {
      ...p.details,
      [WhenDetail.day]: p.day,
      ...(p.time ? { [WhenDetail.time]: p.time } : {}),
    },
    budget: { opening_paise: Math.round(p.budget_paise * OPENING_SHARE), limit_paise: p.budget_paise },
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

/** The detail the chat gathered, by its question's key; nothing when skipped. */
export function draftDetails(d: NeedDraft): Record<string, string> {
  const first = firstQuestion(d.trade);
  return first && d.detail ? { [first]: d.detail } : {};
}

/**
 * The words the workers read: the owner's own, else their answer about the problem, else the trade's name in their
 * language (a need tapped together from chips has no other words).
 */
export function needWords(d: NeedDraft, own: Lang): string {
  const first = firstQuestion(d.trade);
  const detail = first && !YES_NO_QUESTIONS.has(first) ? d.detail : undefined;
  return d.need?.trim() || detail || (d.trade ? t(own, `trade.${d.trade}`) : "");
}
