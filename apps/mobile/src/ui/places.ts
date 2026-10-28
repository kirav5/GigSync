import { asciiDigits, t } from "@gigsync/core";
import { type Lang, PAISE_PER_RUPEE, type Place } from "@gigsync/protocol";

/**
 * Neighbourhoods offered in the pilot, by their centre. Only this approximate point is ever shared. `name` is what
 * the board stores and other phones receive; each phone shows the area in its owner's language from `key`.
 */
export const AREAS = [
  { key: "indiranagar", name: "Indiranagar", lat: 12.9719, lon: 77.6412 },
  { key: "koramangala", name: "Koramangala", lat: 12.9352, lon: 77.6245 },
  { key: "hsr_layout", name: "HSR Layout", lat: 12.9116, lon: 77.6474 },
  { key: "jayanagar", name: "Jayanagar", lat: 12.9308, lon: 77.5838 },
  { key: "whitefield", name: "Whitefield", lat: 12.9698, lon: 77.75 },
] as const satisfies readonly (Place & { key: string; name: string })[];
export type Area = (typeof AREAS)[number];

export const areaNamed = (name: string): Area => AREAS.find((a) => a.name === name) ?? AREAS[0];

/** An area as the owner reads it: a known pilot area in their language, anything else as the board has it. */
export function areaLabel(lang: Lang, name: string): string {
  const known = AREAS.find((a) => a.name === name);
  return known ? t(lang, `area.${known.key}`) : name;
}

/** ₹ for display, Indian grouping, no paise when whole. */
export function money(paise: number): string {
  const rupees = paise / PAISE_PER_RUPEE;
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Rupees as typed, in any script's digits, to paise. */
export const toPaise = (rupees: string) => Math.round(Number(asciiDigits(rupees.trim())) * PAISE_PER_RUPEE);
