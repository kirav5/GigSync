// Collab marketplace index on Cloudflare: the same HTTP API as the Mac's collab-index (POST /query, POST /publish,
// GET /health), plus GET /subscribe (WebSocket) that pushes newly indexed listings matching an open search.
// Listings arrive from sellers' AT Protocol repos through Jetstream, and directly via /publish. Public ("World") notes
// are indexed the same way and searched with GET /notes?q=… Records published before the index existed come in by
// backfill (relay → each repo's PDS), a few repos per cron tick.
import { DurableObject } from "cloudflare:workers";
import { type Filter, LISTING_COLLECTION, type NostrEvent, fromJetstream, matches, normalizeFilter } from "./listing.ts";
import { count, ingest, prune, query, removeRecord } from "./store.ts";
import { NOTE_COLLECTION, countNotes, noteFor, putNote, removeNote, searchNotes } from "./notes.ts";
import { type BackfillState, backfillStep, initialState } from "./backfill.ts";

interface Env { DB: any; HUB: DurableObjectNamespace<IndexHub>; JETSTREAM: string; RELAY: string }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const now = () => Math.floor(Date.now() / 1000);

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const hub = env.HUB.get(env.HUB.idFromName("main"));
    if (req.method === "GET" && url.pathname === "/health") {
      return json({ listings: await count(env.DB, now()), notes: await countNotes(env.DB), following: await hub.following(), backfill: await hub.backfillStatus() });
    }
    if (req.method === "GET" && url.pathname === "/notes") {
      const q = url.searchParams.get("q") ?? "";
      if (q.length > 200) return json({ error: "query too long" }, 400);
      const did = url.searchParams.get("did") ?? undefined;
      return json(await searchNotes(env.DB, q, { did, limit: Number(url.searchParams.get("limit") ?? 20) }));
    }
    if (req.method === "POST" && url.pathname === "/query") {
      const f = normalizeFilter(await req.json().catch(() => null));
      return f?.kinds ? json(await query(env.DB, f, now())) : json({ error: "bad filter" }, 400);
    }
    if (req.method === "POST" && url.pathname === "/publish") {
      const e = await req.json().catch(() => null) as NostrEvent | null;
      if (!e?.id) return json({ error: "bad event" }, 400);
      const row = await ingest(env.DB, e, now());
      if (row) await hub.announce(row);
      return json({ ok: row !== null });
    }
    if (url.pathname === "/subscribe" && req.headers.get("upgrade") === "websocket") return hub.fetch(req);
    return json({ error: "not found" }, 404);
  },
  // Keeps the hub (and its Jetstream connection) alive, and drops expired listings.
  async scheduled(_: ScheduledController, env: Env) {
    const hub = env.HUB.get(env.HUB.idFromName("main"));
    await hub.ensureStream();
    await prune(env.DB, now());
    await hub.backfill();
  },
};

export class IndexHub extends DurableObject<Env> {
  private socket: WebSocket | null = null;

  /** Follows Jetstream for Collab listing records, resuming from the last cursor. */
  async ensureStream() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    const cursor = await this.ctx.storage.get<number>("cursor");
    const url = `${this.env.JETSTREAM}?wantedCollections=${LISTING_COLLECTION}&wantedCollections=${NOTE_COLLECTION}${cursor ? `&cursor=${cursor - 5_000_000}` : ""}`;
    // Workers open outbound WebSockets with fetch over https:// (a wss:// URL is refused).
    let ws: WebSocket | null = null;
    try { ws = (await fetch(url.replace(/^wss:/, "https:"), { headers: { upgrade: "websocket" } })).webSocket; }
    catch (e) { console.log("jetstream connect failed", String(e)); return; }
    if (!ws) return;
    ws.accept();
    this.socket = ws;
    ws.addEventListener("message", ev => this.ctx.waitUntil(this.onJetstream(String(ev.data))));
    ws.addEventListener("close", () => { this.socket = null; });
    ws.addEventListener("error", () => { this.socket = null; });
  }

  private async onJetstream(text: string) {
    let msg: any;
    try { msg = JSON.parse(text); } catch { return; }
    if (typeof msg.time_us === "number") await this.ctx.storage.put("cursor", msg.time_us);
    if (msg?.kind === "commit" && msg.commit?.collection === NOTE_COLLECTION && typeof msg.did === "string" && typeof msg.commit.rkey === "string") {
      if (msg.commit.operation === "delete") { await removeNote(this.env.DB, msg.did, msg.commit.rkey); return; }
      const note = noteFor(msg.did, msg.commit.rkey, msg.commit.record);
      if (note) await putNote(this.env.DB, note, now());
      return;
    }
    const change = fromJetstream(msg);
    if (!change) return;
    if (change.op === "delete") { await removeRecord(this.env.DB, change.did, change.rkey); return; }
    const row = await ingest(this.env.DB, change.event, now(), { did: change.did, rkey: change.rkey });
    if (row) await this.announce(row);
  }

  /** One backfill step per cron tick (state kept between ticks). */
  async backfill() {
    const state = (await this.ctx.storage.get<BackfillState>("backfill")) ?? initialState();
    const db = this.env.DB;
    const { state: next, read } = await backfillStep(state, {
      relay: this.env.RELAY,
      now: now(),
      budget: 40,
      fetchJSON: async (u: string) => {
        try { const r = await fetch(u, { headers: { accept: "application/json" } }); return r.ok ? await r.json() : null; } catch { return null; }
      },
      upsert: async (collection, did, rkey, record) => {
        if (collection === NOTE_COLLECTION) { const n = noteFor(did, rkey, record); if (n) await putNote(db, n, now()); return; }
        if (record?.event) { const row = await ingest(db, record.event, now(), { did, rkey }); if (row) await this.announce(row); }
      },
      reconcile: async (collection, did, rkeys) => {
        const table = collection === NOTE_COLLECTION ? "notes" : "listings";
        const held = (await db.prepare(`SELECT rkey FROM ${table} WHERE did = ?`).bind(did).all()).results as { rkey: string }[];
        for (const h of held) if (h.rkey && !rkeys.includes(h.rkey)) {
          if (table === "notes") await removeNote(db, did, h.rkey); else await removeRecord(db, did, h.rkey);
        }
      },
    });
    await this.ctx.storage.put("backfill", next);
    if (read) console.log("backfill read", read, "repos; queued", next.queue.length);
  }

  async backfillStatus() {
    const s = (await this.ctx.storage.get<BackfillState>("backfill")) ?? initialState();
    return { queued: s.queue.length, lastFullPass: s.lastFullAt || null };
  }

  /** Whether the hub is following Jetstream right now (shown by /health). */
  async following(): Promise<boolean> {
    await this.ensureStream();
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /** Open searches: a client sends its filter once; matching new listings are pushed as they're indexed. */
  async fetch(req: Request): Promise<Response> {
    await this.ensureStream();
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try { ws.serializeAttachment(JSON.parse(String(message)) as Filter); } catch { ws.close(1003, "bad filter"); }
  }

  async announce(row: { event: string } & Parameters<typeof matches>[1]) {
    for (const ws of this.ctx.getWebSockets()) {
      const f = ws.deserializeAttachment() as Filter | null;
      if (f && matches(f, row)) ws.send(row.event);
    }
  }
}
