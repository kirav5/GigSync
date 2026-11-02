import { log } from "@gigsync/core/log";
import {
  coarsePoint,
  type GeoPlace,
  MAX_GEO_PLACES,
  OlaAnswer,
  type OlaPart,
  OlaPartType,
  type OlaResult,
  PinCode,
  type Place,
} from "@gigsync/protocol";

/**
 * Ola Maps (Krutrim) behind our Worker (ADR 0045): the provider sees our Worker's requests only, never the owner's IP
 * or session; a point arrives already coarse and is rounded again here. Its answer is parsed at the boundary and cut
 * down to what the address form fills in.
 */

export const OLA_BASE = "https://api.olamaps.io/places/v1";
export const OlaPath = { reverse: "/reverse-geocode", geocode: "/geocode" } as const;
/** Parameter names Ola's routes take. */
const Param = { key: "api_key", latlng: "latlng", address: "address" } as const;
const LABEL_MAX = 240;
const T = OlaPartType;

/** Turns a coarse point or typed words into places. The routes hold one; tests stub `fetch`. */
export interface Geocoder {
  reverse(point: Place): Promise<GeoPlace[]>;
  search(q: string): Promise<GeoPlace[]>;
}

/** The first address part of any of these types, in this order. */
function partOf(parts: readonly OlaPart[], ...types: readonly string[]): string | undefined {
  for (const type of types) {
    const found = parts.find((p) => p.types.includes(type))?.long_name.trim();
    if (found) return found;
  }
  return undefined;
}

/** One result as a place for the form; undefined when it names no locality. */
export function placeOf(r: OlaResult): GeoPlace | undefined {
  const parts = r.address_components;
  const locality = partOf(parts, T.sublocality1, T.sublocality, T.neighborhood, T.locality);
  if (!locality) return undefined;
  const city = partOf(parts, T.locality);
  const pin = PinCode.safeParse(partOf(parts, T.postalCode)).data;
  const street = partOf(parts, T.route);
  const point = coarsePoint({ lat: r.geometry.location.lat, lon: r.geometry.location.lng });
  const label = (r.formatted_address || locality).slice(0, LABEL_MAX);
  return { label, locality, ...(city ? { city } : {}), ...(pin ? { pin } : {}), ...(street ? { street } : {}), point };
}

/** The places in an answer, at most `MAX_GEO_PLACES`, one per line. */
function placesIn(answer: OlaAnswer): GeoPlace[] {
  const results = [...(answer.results ?? []), ...(answer.geocodingResults ?? [])];
  const places = results.map(placeOf).filter((p): p is GeoPlace => p !== undefined);
  const seen = new Set<string>();
  return places.filter((p) => !seen.has(p.label) && seen.add(p.label)).slice(0, MAX_GEO_PLACES);
}

export class GeocodeError extends Error {}

/** Ola Maps with this key. A failed call throws `GeocodeError`; the route answers 502 and the app falls back to typing. */
export function olaGeocoder(key: string): Geocoder {
  async function get(path: string, params: Record<string, string>): Promise<GeoPlace[]> {
    const url = `${OLA_BASE}${path}?${new URLSearchParams({ ...params, [Param.key]: key })}`;
    const res = await fetch(url);
    if (!res.ok) {
      log.warn("geocoder failed", { path, status: res.status });
      throw new GeocodeError(`geocoder answered ${res.status}`);
    }
    const answer = OlaAnswer.safeParse(await res.json().catch(() => null));
    if (!answer.success) throw new GeocodeError("geocoder answer did not parse");
    return placesIn(answer.data);
  }
  return {
    reverse: (point) => {
      const p = coarsePoint(point);
      return get(OlaPath.reverse, { [Param.latlng]: `${p.lat},${p.lon}` });
    },
    search: (q) => get(OlaPath.geocode, { [Param.address]: q }),
  };
}
