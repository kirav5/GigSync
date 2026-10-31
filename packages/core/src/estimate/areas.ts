import type { AreaKey, Place } from "@gigsync/protocol";

/**
 * Neighbourhoods offered in the pilot, by their centre. Only this approximate point is ever shared. `name` is what
 * the board stores and other phones receive; each phone shows the area in its owner's language from `key`
 * (`area.<key>` in the strings). A job's area travels to the server as its slug (ADR 0039 §1), never as a point.
 */
export const PILOT_AREAS = [
  { key: "indiranagar", name: "Indiranagar", lat: 12.9719, lon: 77.6412 },
  { key: "koramangala", name: "Koramangala", lat: 12.9352, lon: 77.6245 },
  { key: "hsr_layout", name: "HSR Layout", lat: 12.9116, lon: 77.6474 },
  { key: "jayanagar", name: "Jayanagar", lat: 12.9308, lon: 77.5838 },
  { key: "whitefield", name: "Whitefield", lat: 12.9698, lon: 77.75 },
] as const satisfies readonly (Place & { key: string; name: string })[];
export type PilotArea = (typeof PILOT_AREAS)[number];

const KEY_SEPARATOR = /_/g;
const SLUG_SEPARATOR = "-";

/** An area's key as the slug the server keeps: "hsr_layout" → "hsr-layout". */
export const areaSlug = (key: string): AreaKey => key.replace(KEY_SEPARATOR, SLUG_SEPARATOR);

/**
 * The pilot area a point is the centre of, as its slug ("hsr-layout"); undefined for any other point. Only area
 * centres are ever shared, so a job's point is one of them or none.
 */
export function areaKeyOf(place: Place): AreaKey | undefined {
  const area = PILOT_AREAS.find((a) => a.lat === place.lat && a.lon === place.lon);
  return area && areaSlug(area.key);
}

/** The pilot area a slug names, for showing it in the owner's language; undefined for any other slug. */
export const areaOfSlug = (slug: string): PilotArea | undefined => PILOT_AREAS.find((a) => areaSlug(a.key) === slug);
