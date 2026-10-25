// Collab marketplace index on Cloudflare: the same HTTP API as the Mac's collab-index (POST /query, POST /publish,
// GET /health), plus GET /subscribe (WebSocket) that pushes newly indexed listings matching an open search.
// Listings arrive from sellers' AT Protocol repos through Jetstream, and directly via /publish. Public ("World") notes
// are indexed the same way and searched with GET /notes?q=… Records published before the index existed come in by
// backfill (relay → each repo's PDS), a few repos per cron tick. The Jetstream follower lives in hub.ts.
import { ContentType, Header, HttpMethod, WEBSOCKET_UPGRADE } from "@gigsync/core/http";
import { configureLog, log } from "@gigsync/core/log";
import { HUB_NAME, MAX_SEARCH_LENGTH, NotesParam, Path } from "./constants.ts";
import { type Env, nowSeconds } from "./env.ts";
import { asNostrEvent, normalizeFilter } from "./listing.ts";
import { countNotes, searchNotes } from "./notes.ts";
import { count, ingest, prune, query } from "./store.ts";

export { IndexHub } from "./hub.ts";

const IndexError = {
  badEvent: "bad event",
  badFilter: "bad filter",
  notFound: "not found",
  queryTooLong: "query too long",
} as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { [Header.contentType]: ContentType.json } });

const hubFor = (env: Env) => env.HUB.get(env.HUB.idFromName(HUB_NAME));
const isRoute = (req: Request, url: URL, method: string, path: string) =>
  req.method === method && url.pathname === path;

async function health(env: Env) {
  const hub = hubFor(env);
  return json({
    listings: await count(env.DB, nowSeconds()),
    notes: await countNotes(env.DB),
    following: await hub.following(),
    backfill: await hub.backfillStatus(),
  });
}

async function notes(env: Env, url: URL) {
  const q = url.searchParams.get(NotesParam.q) ?? "";
  if (q.length > MAX_SEARCH_LENGTH) return json({ error: IndexError.queryTooLong }, 400);
  const did = url.searchParams.get(NotesParam.did) ?? undefined;
  const limit = Number(url.searchParams.get(NotesParam.limit)) || undefined;
  return json(await searchNotes(env.DB, q, { ...(did ? { did } : {}), ...(limit ? { limit } : {}) }));
}

async function search(env: Env, req: Request) {
  const f = normalizeFilter(await req.json().catch(() => null));
  return f ? json(await query(env.DB, f, nowSeconds())) : json({ error: IndexError.badFilter }, 400);
}

async function publish(env: Env, req: Request) {
  const e = asNostrEvent(await req.json().catch(() => null));
  if (!e) return json({ error: IndexError.badEvent }, 400);
  const row = await ingest(env.DB, e, nowSeconds());
  log.info("index: publish", { eventId: e.id, indexed: row !== null });
  if (row) await hubFor(env).announce(row);
  return json({ ok: row !== null });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    configureLog(env);
    const url = new URL(req.url);
    log.debug("index: request", { method: req.method, path: url.pathname, query: url.search });
    if (isRoute(req, url, HttpMethod.get, Path.health)) return health(env);
    if (isRoute(req, url, HttpMethod.get, Path.notes)) return notes(env, url);
    if (isRoute(req, url, HttpMethod.post, Path.query)) return search(env, req);
    if (isRoute(req, url, HttpMethod.post, Path.publish)) return publish(env, req);
    if (url.pathname === Path.subscribe && req.headers.get(Header.upgrade) === WEBSOCKET_UPGRADE) {
      return hubFor(env).fetch(req);
    }
    return json({ error: IndexError.notFound }, 404);
  },

  // Keeps the hub (and its Jetstream connection) alive, and drops expired listings.
  async scheduled(_: ScheduledController, env: Env) {
    configureLog(env);
    const hub = hubFor(env);
    await hub.ensureStream();
    await prune(env.DB, nowSeconds());
    await hub.backfill();
  },
};
