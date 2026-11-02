import { arrangementIn, type MessageKey, PILOT_AREAS, type PilotArea, t } from "@gigsync/core";
import { Arrangement, City, type JobRequest, type Lang, PAISE_PER_RUPEE } from "@gigsync/protocol";

/** The pilot's areas live in core, which also turns a job's point into the slug its record carries. */
export { areaKeyOf } from "@gigsync/core";
export const AREAS = PILOT_AREAS;
export type Area = PilotArea;

export const areaNamed = (name: string): Area => AREAS.find((a) => a.name === name) ?? AREAS[0];

/** The pilot's city, for rate estimates (ADR 0030). */
export const PILOT_CITY: City = City.enum.bengaluru;

/** An area as the owner reads it: a known pilot area in their language, anything else as the board has it. */
export function areaLabel(lang: Lang, name: string): string {
  const known = AREAS.find((a) => a.name === name);
  return known ? t(lang, `area.${known.key}`) : name;
}

/** An amount as a form field holds it: whole rupees, as typed ("7000"); empty when there is none. */
export const rupeesOf = (paise?: number): string => (paise ? String(paise / PAISE_PER_RUPEE) : "");

const UNIT_KEY: Readonly<Record<Arrangement, MessageKey>> = {
  [Arrangement.enum.hourly]: "unit.hour",
  [Arrangement.enum.visit]: "unit.visit",
  [Arrangement.enum.weekly]: "unit.week",
  [Arrangement.enum.monthly]: "unit.month",
};

/** What an arrangement's price is per, in words: "an hour", "a month" (ADR 0046). */
export const unitKey = (arrangement: Arrangement): MessageKey => UNIT_KEY[arrangement];

/**
 * A job's price as both owners read it (ADR 0046): with its unit when the job is by the hour, the visit, the week or
 * the month ("₹180 an hour"), else the amount alone.
 */
export function jobPrice(lang: Lang, request: Pick<JobRequest, "trade" | "details">, paise: number): string {
  const arrangement = arrangementIn(request.trade, request.details);
  if (!arrangement) return money(paise);
  return t(lang, "price.per", { price: money(paise), unit: t(lang, unitKey(arrangement)) });
}

/** ₹ for display, Indian grouping, no paise when whole. */
export function money(paise: number): string {
  const rupees = paise / PAISE_PER_RUPEE;
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
