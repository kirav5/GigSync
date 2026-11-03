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

/** A point this close to a pilot area's centre is in that area (ADR 0045): its estimates, its name in each language. */
export const PILOT_AREA_KM = 3;
const KM_PER_DEGREE = 111;
const RADIANS = Math.PI / 180;

/** Kilometres between two points, flat-earth: exact enough across a city. */
export const kmBetween = (a: Place, b: Place): number =>
  Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos(a.lat * RADIANS)) * KM_PER_DEGREE;

/**
 * The pilot area a point is in: the nearest centre within `PILOT_AREA_KM`. A request's point is rounded to about a
 * kilometre before it leaves the phone (ADR 0045), and older requests carried a centre exactly; both land here.
 */
export function nearestPilotArea(place: Place): PilotArea | undefined {
  const nearest = [...PILOT_AREAS].sort((x, y) => kmBetween(place, x) - kmBetween(place, y))[0];
  return nearest && kmBetween(place, nearest) <= PILOT_AREA_KM ? nearest : undefined;
}

/** The pilot area a point is in, as its slug ("hsr-layout"); undefined for a point in none. */
export function areaKeyOf(place: Place): AreaKey | undefined {
  const area = nearestPilotArea(place);
  return area && areaSlug(area.key);
}

/** The pilot area a slug names, for showing it in the owner's language; undefined for any other slug. */
export const areaOfSlug = (slug: string): PilotArea | undefined => PILOT_AREAS.find((a) => areaSlug(a.key) === slug);
