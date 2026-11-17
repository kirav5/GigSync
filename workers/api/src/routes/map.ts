import { log } from "@gigsync/core/log";
import { type Context, Hono, type Next } from "hono";
import { ApiError, type AppEnv, Var } from "../context.js";

/**
 * Ola Maps' vector map behind our Worker (ADR 0050 §7), for MapLibre on the phone: the style, and every tile, font
 * and sprite it names, fetched here with the key and cached at the edge. Ola sees our Worker, never the owner, and the
 * key never ships in the app. The style's links to Ola are rewritten to this route, so the phone asks only GigSync,
 * with its session. Only Ola's map paths pass (`MAP_PREFIX`): this is not a way to reach Ola's other APIs.
 */
export const map = new Hono<AppEnv>();

export const OLA_ORIGIN = "https://api.olamaps.io";
/** The style the app draws: Ola's light standard map. */
export const STYLE_PATH = "tiles/vector/v1/styles/default-light-standard/style.json";
/** Ola's map paths; anything else is refused. */
const MAP_PREFIX = "tiles/";
/** Where this route is mounted, for the links it writes into the style. */
export const MAP_ROUTE = "/v1/geo/map/";
const KEY_PARAM = "api_key";
const Path = { style: "/style.json", any: "/*" } as const;
/** A week for tiles and a day for the style: the map changes slowly, and each fetch is billed. */
const TILE_SECONDS = 7 * 24 * 60 * 60;
const STYLE_SECONDS = 24 * 60 * 60;
const JSON_TYPE = "application/json";
const TRAVERSAL = /(^|\/)\.\.(\/|$)/;

type MapContext = Context<AppEnv>;

/** Every Ola link in a style or tile document pointed at this route, with the key taken out. */
export function rewritten(text: string, base: string): string {
  return text
    .replaceAll(`${OLA_ORIGIN}/`, base)
    .replace(new RegExp(`([?&])${KEY_PARAM}=[^&"]*&?`, "g"), (_, sep: string) => sep)
    .replace(/[?&]"/g, '"');
}

/** Ola's URL for a map path and query, without the key: the edge cache's key too. */
function upstreamOf(path: string, query: string): URL {
  const upstream = new URL(`${OLA_ORIGIN}/${path}`);
  for (const [k, v] of new URLSearchParams(query)) if (k !== KEY_PARAM) upstream.searchParams.append(k, v);
  return upstream;
}

/** The map path a request under this route asks for: the style's own, or the tile, font or sprite after the route. */
function pathOf(c: MapContext): { path: string; query: string } {
  const url = new URL(c.req.url);
  const after = url.pathname.slice(url.pathname.indexOf(MAP_ROUTE) + MAP_ROUTE.length);
  const path = after === Path.style.slice(1) ? STYLE_PATH : decodeURIComponent(after);
  return { path, query: after === Path.style.slice(1) ? "" : url.search };
}

/**
 * A map part the edge already holds, answered before the directory connection and the session check (index.ts): it
 * costs Ola nothing and is the same public map for everyone, and a map draws dozens of tiles, so each skipping a
 * database round trip is what makes it quick. Anything not held goes on to the signed-in route, which fetches it.
 */
export async function cachedMap(c: MapContext, next: Next): Promise<Response | undefined> {
  const { path, query } = pathOf(c);
  const servable = path.startsWith(MAP_PREFIX) && !TRAVERSAL.test(path);
  const hit = servable ? await caches.default.match(new Request(upstreamOf(path, query).toString())) : undefined;
  if (hit) return hit;
  await next();
  return undefined;
}

/** Ola's answer for `path`, from the edge cache when it has it; JSON documents with their links rewritten. */
async function fetchMap(c: MapContext, path: string, query: string, maxAge: number): Promise<Response> {
  const key = c.env.OLA_MAPS_API_KEY;
  if (!key) return c.json({ error: ApiError.geocodingOff }, 503);
  if (!path.startsWith(MAP_PREFIX) || TRAVERSAL.test(path)) return c.json({ error: ApiError.notFound }, 404);
  const upstream = upstreamOf(path, query);
  const cacheKey = new Request(upstream.toString());
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  upstream.searchParams.set(KEY_PARAM, key);
  const res = await fetch(upstream.toString());
  if (!res.ok) {
    log.warn("map fetch failed", { requestId: c.get(Var.requestId), status: res.status });
    return c.json({ error: ApiError.geocodingFailed }, 502);
  }
  const type = res.headers.get("content-type") ?? "";
  const base = `${new URL(c.req.url).origin}${MAP_ROUTE}`;
  const body = type.includes(JSON_TYPE) ? rewritten(await res.text(), base) : await res.arrayBuffer();
  // The edge copy says public: the Cache API never stores a `private` answer, so every tile used to go to Ola. It is
  // the same public map for everyone, and anything not yet held still needs a session (cachedMap).
  const headers = { "content-type": type, "cache-control": `public, max-age=${maxAge}` };
  await cache.put(cacheKey, new Response(body, { headers }));
  return new Response(body, { headers });
}

map.get(Path.style, (c) => fetchMap(c, STYLE_PATH, "", STYLE_SECONDS));

map.get(Path.any, (c) => {
  const { path, query } = pathOf(c);
  return fetchMap(c, path, query, TILE_SECONDS);
});
