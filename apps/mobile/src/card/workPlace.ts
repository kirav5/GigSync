import { localitySlug, nearestPilotArea } from "@gigsync/core";
import { coarsePoint, type GeoPlace, type Place } from "@gigsync/protocol";

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

/** No place names from the server: the pilot area the phone is in, at the phone's own coarse point. */
export function pilotPlace(point: Place): FoundPlace | undefined {
  const pilot = nearestPilotArea(point);
  return pilot && { area: pilot.key, place: { name: pilot.name, ...coarsePoint(point) } };
}
