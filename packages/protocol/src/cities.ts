import { z } from "zod";
import { Place } from "./place.js";

/**
 * The cities and areas GigSync serves, kept in the directory (ADR 0061) so a new one is data, not a release. A place
 * is served inside a live city's circle; its areas are the neighbourhoods Find offers by name and prices by.
 */

/** A city or area key: lower case, digits and underscores ("bengaluru", "hsr_layout"). */
export const PlaceKey = z
  .string()
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, "place key")
  .max(40);
export type PlaceKey = z.infer<typeof PlaceKey>;

const NAME_MAX = 60;
/** A name in each language the app speaks. */
export const PlaceNames = z.object({
  en: z.string().min(1).max(NAME_MAX),
  hi: z.string().min(1).max(NAME_MAX),
  kn: z.string().min(1).max(NAME_MAX),
});
export type PlaceNames = z.infer<typeof PlaceNames>;

export const MAX_CITY_RADIUS_KM = 80;
export const MAX_CITY_AREAS = 200;

export const ServedArea = z.object({ key: PlaceKey, names: PlaceNames, centre: Place });
export type ServedArea = z.infer<typeof ServedArea>;

export const ServedCity = z.object({
  key: PlaceKey,
  names: PlaceNames,
  /** The state, for its minimum wages and rate card ("karnataka", "uttar_pradesh"). */
  state: PlaceKey,
  centre: Place,
  radius_km: z.number().positive().max(MAX_CITY_RADIUS_KM),
  areas: z.array(ServedArea).max(MAX_CITY_AREAS),
});
export type ServedCity = z.infer<typeof ServedCity>;

/** `GET /v1/cities`: the live cities and their live areas. */
export const ServedCities = z.object({ cities: z.array(ServedCity) });
export type ServedCities = z.infer<typeof ServedCities>;

/** `PUT /v1/admin/cities`: a city and its areas added or changed; `live: false` takes it off without deleting it. */
export const CityUpsert = ServedCity.extend({ live: z.boolean().default(true) });
export type CityUpsert = z.infer<typeof CityUpsert>;
