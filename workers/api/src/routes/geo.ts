import { log } from "@gigsync/core/log";
import { coarsePoint, type GeoPlace, type GeoResult, GeoReverseQuery, GeoSearchQuery } from "@gigsync/protocol";
import { type Context, Hono } from "hono";
import { ApiError, type AppEnv, Var } from "../context.js";
import { GeocodeError, type Geocoder, olaGeocoder } from "../geo/ola.js";

/**
 * Geocoding for the address form (ADR 0045), behind the session middleware: a coarse point to its locality, city and
 * PIN, or typed words to places. Answers are cached at the edge for a month by rounded point or normalised words, so
 * the same cell is asked of the provider once. Coordinates and words are never logged.
 */
export const geo = new Hono<AppEnv>();

const Path = { reverse: "/reverse", search: "/search" } as const;
/** A month: localities and PIN codes change slowly. */
const CACHE_SECONDS = 30 * 24 * 60 * 60;
/** Where cached answers are filed: a name of our own, never fetched. */
const CACHE_ORIGIN = "https://geo-cache.gigsync.internal";
const CacheKind = { reverse: "reverse", search: "search" } as const;

type GeoContext = Context<AppEnv>;

/** The provider, when its key is set; without it the routes answer 503 and the app offers typing instead. */
const geocoderOf = (c: GeoContext): Geocoder | undefined =>
  c.env.OLA_MAPS_API_KEY ? olaGeocoder(c.env.OLA_MAPS_API_KEY) : undefined;

/** The cached answer for `key`, else the provider's, cached. */
async function cached(kind: string, key: string, ask: () => Promise<GeoPlace[]>): Promise<GeoPlace[]> {
  const request = new Request(`${CACHE_ORIGIN}/${kind}/${encodeURIComponent(key)}`);
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return ((await hit.json()) as GeoResult).places;
  const places = await ask();
  const headers = { "cache-control": `max-age=${CACHE_SECONDS}` };
  await cache.put(request, Response.json({ places } satisfies GeoResult, { headers }));
  return places;
}

/** The shared path of both routes: the caller's limit, the key, the provider and its failures. */
async function answer(c: GeoContext, kind: string, key: string, ask: (g: Geocoder) => Promise<GeoPlace[]>) {
  if (!(await c.env.GEO_RATE_LIMIT.limit({ key: c.get(Var.user) })).success)
    return c.json({ error: ApiError.tooManyAttempts }, 429);
  const geocoder = geocoderOf(c);
  if (!geocoder) return c.json({ error: ApiError.geocodingOff }, 503);
  try {
    const places = await cached(kind, key, () => ask(geocoder));
    log.info("geocoded", { requestId: c.get(Var.requestId), kind, found: places.length });
    return c.json({ places } satisfies GeoResult);
  } catch (err) {
    if (!(err instanceof GeocodeError)) throw err;
    return c.json({ error: ApiError.geocodingFailed }, 502);
  }
}

geo.get(Path.reverse, async (c) => {
  const q = GeoReverseQuery.safeParse(c.req.query());
  if (!q.success) return c.json({ error: ApiError.badRequest }, 400);
  const point = coarsePoint(q.data);
  return answer(c, CacheKind.reverse, `${point.lat},${point.lon}`, (g) => g.reverse(point));
});

geo.get(Path.search, async (c) => {
  const q = GeoSearchQuery.safeParse(c.req.query());
  if (!q.success) return c.json({ error: ApiError.badRequest }, 400);
  const words = q.data.q.toLowerCase().replace(/\s+/g, " ");
  return answer(c, CacheKind.search, words, (g) => g.search(words));
});
