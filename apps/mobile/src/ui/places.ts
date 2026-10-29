import { t } from "@gigsync/core";
import { City, type Lang, PAISE_PER_RUPEE, type Place } from "@gigsync/protocol";

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

/** The pilot's city, for rate estimates (ADR 0030). */
export const PILOT_CITY: City = City.enum.bengaluru;

const NOT_SLUG = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

/**
 * The pilot area a point is the centre of, as the slug a shared price carries ("hsr-layout"); undefined for any other
 * point. Only area centres are ever shared, so a job's point is one of them or none.
 */
export function areaKeyOf(place: Place): string | undefined {
  const area = AREAS.find((a) => a.lat === place.lat && a.lon === place.lon);
  return area?.name.toLowerCase().replace(NOT_SLUG, "-").replace(EDGE_DASHES, "");
}

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
