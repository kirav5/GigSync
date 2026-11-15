import { z } from "zod";

/** An approximate place (a neighbourhood, never a door): what discovery and the request use. */
export const Place = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
export type Place = z.infer<typeof Place>;

/** A locality's name, as a geocoder or the owner gives it ("Banashankari 2nd Stage"). */
export const LOCALITY_MAX = 60;

/** Two decimal places of a degree, about 1.1 km: the grid every point leaving a phone is rounded to (ADR 0045). */
const COARSE_SCALE = 100;
const coarse = (degrees: number): number => Math.round(degrees * COARSE_SCALE) / COARSE_SCALE;

/** A point rounded to the coarse grid: a neighbourhood, never a building. */
export const coarsePoint = (p: Place): Place => ({ lat: coarse(p.lat), lon: coarse(p.lon) });

/**
 * Five decimal places, about a metre: a public place a search found (a building, a gate), whose point is the
 * provider's own and no one's secret. Never used for the owner's own fix, which goes out only on the coarse grid.
 */
const PRECISE_SCALE = 100_000;
export const precisePoint = (p: Place): Place => ({
  lat: Math.round(p.lat * PRECISE_SCALE) / PRECISE_SCALE,
  lon: Math.round(p.lon * PRECISE_SCALE) / PRECISE_SCALE,
});
