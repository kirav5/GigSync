import type { City, Place } from "@gigsync/protocol";

/** Where a city with a guide is: a centre and how far from it still counts as that city. */
export interface CityArea {
  centre: Place;
  radius_km: number;
}

/**
 * The cities with a guide, on the map: used only to tell whether a signed job was in the city of the move. Bengaluru's
 * centre is Majestic (Kempegowda bus station); 30 km covers the city corporation and its edges (Whitefield, Kengeri).
 */
export const CITY_AREA: Readonly<Record<City, CityArea>> = {
  bengaluru: { centre: { lat: 12.9767, lon: 77.5713 }, radius_km: 30 },
};
