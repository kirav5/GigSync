import { localitySlug, nearestPilotArea } from "@gigsync/core";
import { coarsePoint, type GeoPlace, type Place } from "@gigsync/protocol";
import { servesAnywhere } from "../adapters/cities.js";

/** Where a worker's location says they work from (ADR 0045): an area key with the place's name and coarse point. */
export interface FoundPlace {
  area: string;
  place: { name: string; lat: number; lon: number };
}

/** The locality the server named, at the phone's coarse point; none when its name makes no key. */
export function workPlace(place: GeoPlace, point: Place): FoundPlace | undefined {
  const area = localitySlug(place.locality);
  return area ? { area, place: { name: place.locality, ...coarsePoint(point) } } : undefined;
}

/**
 * No place names from the server: the pilot area the phone is in, at the phone's own coarse point. Outside them, when
 * the server lets every place in (`LIVE_CITIES=*`, for testing), the coarse point names the place itself.
 */
export function pointOnlyPlace(point: Place): FoundPlace | undefined {
  const at = coarsePoint(point);
  const pilot = nearestPilotArea(point);
  if (pilot) return { area: pilot.key, place: { name: pilot.name, ...at } };
  if (!servesAnywhere()) return undefined;
  const name = `${at.lat}, ${at.lon}`;
  const area = localitySlug(name);
  return area ? { area, place: { name, ...at } } : undefined;
}
