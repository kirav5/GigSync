import { PILOT_AREAS, type PilotArea, t } from "@gigsync/core";
import { City, type Lang, PAISE_PER_RUPEE } from "@gigsync/protocol";

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

/** ₹ for display, Indian grouping, no paise when whole. */
export function money(paise: number): string {
  const rupees = paise / PAISE_PER_RUPEE;
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
