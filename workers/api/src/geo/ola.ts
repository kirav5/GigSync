import { log } from "@gigsync/core/log";
import {
  coarsePoint,
  type GeoPlace,
  LOCALITY_MAX,
  MAX_GEO_PLACES,
  OlaAnswer,
  type OlaPart,
  OlaPartType,
  type OlaPrediction,
  type OlaResult,
  PinCode,
  type Place,
  precisePoint,
} from "@gigsync/protocol";

/**
 * Ola Maps (Krutrim) behind our Worker (ADR 0045): the provider sees our Worker's requests only, never the owner's IP
 * or session; the owner's own point arrives already coarse and is rounded again here. A place found by search is
 * public, so its own point is kept (to about a metre) and its area named from there. Answers are parsed at the
 * boundary and cut down to what the address form fills in.
 */

export const OLA_BASE = "https://api.olamaps.io/places/v1";
export const OlaPath = { reverse: "/reverse-geocode", autocomplete: "/autocomplete" } as const;
/** Parameter names Ola's routes take. */
export const OlaParam = {
  key: "api_key",
  latlng: "latlng",
  input: "input",
  location: "location",
  radius: "radius",
} as const;
/** How far around the city's centre suggestions are favoured, in metres: a city and its edges, not a hard limit. */
export const BIAS_RADIUS_M = 50_000;
const LABEL_MAX = 240;
const T = OlaPartType;

/** Turns the owner's coarse point, or typed words near a city, into places. The routes hold one; tests stub `fetch`. */
export interface Geocoder {
  reverse(point: Place): Promise<GeoPlace[]>;
  search(q: string, near?: Place): Promise<GeoPlace[]>;
}

/** Keeps an answer under a key, as the route's edge cache does: a found place is named once for every search. */
export type Remember = (kind: string, key: string, ask: () => Promise<GeoPlace[]>) => Promise<GeoPlace[]>;
const askAgain: Remember = (_kind, _key, ask) => ask();
/** Under what `Remember` files the naming of a found place's own point. */
export const NAMED_KIND = "named";

type Round = (p: Place) => Place;

/** The first address part of any of these types, in this order. */
function partOf(parts: readonly OlaPart[], ...types: readonly string[]): string | undefined {
  for (const type of types) {
    const found = parts.find((p) => p.types.includes(type))?.long_name.trim();
    if (found) return found;
  }
  return undefined;
}

/** One result as a place for the form, its point rounded by `round`; undefined when it names no locality. */
export function placeOf(r: OlaResult, round: Round = coarsePoint): GeoPlace | undefined {
  const parts = r.address_components;
  const locality = partOf(parts, T.sublocality1, T.sublocality, T.neighborhood, T.locality);
  if (!locality) return undefined;
  const city = partOf(parts, T.locality);
  const pin = PinCode.safeParse(partOf(parts, T.postalCode)).data;
  const street = partOf(parts, T.route);
  const point = round({ lat: r.geometry.location.lat, lon: r.geometry.location.lng });
  const label = (r.formatted_address || locality).slice(0, LABEL_MAX);
  return { label, locality, ...(city ? { city } : {}), ...(pin ? { pin } : {}), ...(street ? { street } : {}), point };
}

/** The places in an answer, at most `MAX_GEO_PLACES`, one per line. */
function placesIn(answer: OlaAnswer, round: Round): GeoPlace[] {
  const results = [...(answer.results ?? []), ...(answer.geocodingResults ?? [])];
  const places = results.map((r) => placeOf(r, round)).filter((p): p is GeoPlace => p !== undefined);
  const seen = new Set<string>();
  return places.filter((p) => !seen.has(p.label) && seen.add(p.label)).slice(0, MAX_GEO_PLACES);
}

/**
 * The area a suggestion's own line names: the part just before its city ("…, Bayanna Layout, Hebbal, Bengaluru, …"),
 * never the place's own name in front. Ola's address parts for a point can disagree with its line (Hebbal flyover's
 * say Sanjay Nagar), and the owner reads the line.
 */
function areaInLine(s: OlaPrediction, city: string | undefined): string | undefined {
  if (!city) return undefined;
  const words = s.terms.map((t) => t.value.trim());
  const at = words.map((w) => w.toLowerCase()).lastIndexOf(city.toLowerCase());
  const area = at > 1 ? words[at - 1] : undefined;
  return area && area.length <= LOCALITY_MAX ? area : undefined;
}

/** A suggestion's area: as its line says it, else the first place at its point whose locality the line names. */
function areaOf(s: OlaPrediction, at: readonly GeoPlace[]): GeoPlace | undefined {
  const line = s.description.toLowerCase();
  const place = at.find((p) => line.includes(p.locality.toLowerCase())) ?? at[0];
  const locality = place && areaInLine(s, place.city);
  return place && locality ? { ...place, locality } : place;
}

export class GeocodeError extends Error {}

/**
 * Ola Maps with this key. A failed call throws `GeocodeError`; the route answers 502 and the app falls back to typing.
 * `remember` keeps the naming of a found place, which the searches made as the owner types share.
 */
export function olaGeocoder(key: string, remember: Remember = askAgain): Geocoder {
  async function get(path: string, params: Record<string, string>): Promise<OlaAnswer> {
    const url = `${OLA_BASE}${path}?${new URLSearchParams({ ...params, [OlaParam.key]: key })}`;
    const res = await fetch(url);
    if (!res.ok) {
      log.warn("geocoder failed", { path, status: res.status });
      throw new GeocodeError(`geocoder answered ${res.status}`);
    }
    const answer = OlaAnswer.safeParse(await res.json().catch(() => null));
    if (!answer.success) throw new GeocodeError("geocoder answer did not parse");
    return answer.data;
  }
  /** The places at a point, rounded by `round` on the way in and on the way out. */
  const at = async (point: Place, round: Round): Promise<GeoPlace[]> => {
    const p = round(point);
    return placesIn(await get(OlaPath.reverse, { [OlaParam.latlng]: `${p.lat},${p.lon}` }), round);
  };
  /** The owner's own point: only ever on the coarse grid. */
  const reverse = (point: Place): Promise<GeoPlace[]> => at(point, coarsePoint);
  /** A found place's area, from its own point: its coarse cell's can be the next locality over. */
  const named = (point: Place): Promise<GeoPlace[]> =>
    remember(NAMED_KIND, `${point.lat},${point.lon}`, () => at(point, precisePoint));
  /**
   * Typed words through autocomplete, which knows areas by name where geocoding an address sends "Jayanagar 4th
   * Block" to Nagpur, favouring the city around `near`. Each suggestion keeps its own point and line; its area, city
   * and PIN come from a reverse lookup of that same point, as a pin dropped on it would give them.
   */
  const search = async (q: string, near?: Place): Promise<GeoPlace[]> => {
    const bias = near && coarsePoint(near);
    const params = {
      [OlaParam.input]: q,
      ...(bias && { [OlaParam.location]: `${bias.lat},${bias.lon}`, [OlaParam.radius]: String(BIAS_RADIUS_M) }),
    };
    const { predictions = [] } = await get(OlaPath.autocomplete, params);
    const places = await Promise.all(
      predictions.slice(0, MAX_GEO_PLACES).map(async (s) => {
        const point = precisePoint({ lat: s.geometry.location.lat, lon: s.geometry.location.lng });
        const area = areaOf(s, await named(point));
        return area ? { ...area, label: s.description.slice(0, LABEL_MAX), point } : undefined;
      }),
    );
    const seen = new Set<string>();
    return places.filter((p): p is GeoPlace => p !== undefined && !seen.has(p.label) && Boolean(seen.add(p.label)));
  };
  return { reverse, search };
}
