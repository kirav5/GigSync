import { log } from "@gigsync/core/log";
import { type Context, Hono } from "hono";
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

/** Ola's answer for `path`, from the edge cache when it has it; JSON documents with their links rewritten. */
async function fetchMap(c: MapContext, path: string, query: string, maxAge: number): Promise<Response> {
  const key = c.env.OLA_MAPS_API_KEY;
  if (!key) return c.json({ error: ApiError.geocodingOff }, 503);
  if (!path.startsWith(MAP_PREFIX) || TRAVERSAL.test(path)) return c.json({ error: ApiError.notFound }, 404);
  const upstream = new URL(`${OLA_ORIGIN}/${path}`);
  for (const [k, v] of new URLSearchParams(query)) if (k !== KEY_PARAM) upstream.searchParams.append(k, v);
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
  const headers = { "content-type": type, "cache-control": `private, max-age=${maxAge}` };
  const answer = new Response(body, { headers });
  await cache.put(cacheKey, answer.clone());
  return answer;
}

map.get(Path.style, (c) => fetchMap(c, STYLE_PATH, "", STYLE_SECONDS));

map.get(Path.any, (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname.slice(url.pathname.indexOf(MAP_ROUTE) + MAP_ROUTE.length);
  return fetchMap(c, decodeURIComponent(path), url.search, TILE_SECONDS);
});
