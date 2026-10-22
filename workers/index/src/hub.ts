import { DurableObject } from "cloudflare:workers";
import { ContentType, Header, WEBSOCKET_UPGRADE } from "@collab/core/http";
import { configureLog, LogLevel, log, logEnabled } from "@collab/core/log";
import { type BackfillState, backfillStep, initialState } from "./backfill.ts";
import { CommitOp, CURSOR_REWIND_US, JETSTREAM_COMMIT, StorageKey, Table } from "./constants.ts";
import { type Env, nowSeconds } from "./env.ts";
import { isObject, num, obj, parseJson, str } from "./json.ts";
import {
  asNostrEvent,
  ChangeOp,
  type Filter,
  fromJetstream,
  LISTING_COLLECTION,
  matches,
  normalizeFilter,
  type Row,
} from "./listing.ts";
import { NOTE_COLLECTION, noteFor, putNote, removeNote } from "./notes.ts";
import { ingest, removeRecord } from "./store.ts";

/** Outbound requests one backfill run may make; Workers cap subrequests per invocation. */
const BACKFILL_BUDGET = 40;
/** WebSocket close code for a message the server cannot accept. */
const UNSUPPORTED_DATA = 1003;

/**
 * One Durable Object follows Jetstream (an outbound WebSocket keeps it alive) and holds open searches (hibernatable
 * sockets), so every new listing is matched against every open search in one place.
 */
export class IndexHub extends DurableObject<Env> {
  private socket: WebSocket | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    configureLog(env);
  }

  /** Follows Jetstream for Collab listing and note records, resuming from the last cursor. */
  async ensureStream() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    const cursor = await this.ctx.storage.get<number>(StorageKey.cursor);
    const url = new URL(this.env.JETSTREAM);
    for (const c of [LISTING_COLLECTION, NOTE_COLLECTION]) url.searchParams.append("wantedCollections", c);
    if (cursor) url.searchParams.set("cursor", String(cursor - CURSOR_REWIND_US));
    // Workers open outbound WebSockets with fetch over https:// (a wss:// URL is refused).
    url.protocol = "https:";
    let ws: WebSocket | null = null;
    try {
      ws = (await fetch(url, { headers: { [Header.upgrade]: WEBSOCKET_UPGRADE } })).webSocket;
    } catch (error) {
      log.warn("index: jetstream connect failed", { error });
      return;
    }
    if (!ws) {
      log.warn("index: jetstream refused the upgrade");
      return;
    }
    log.info("index: jetstream connected", { cursor: cursor ?? null });
    ws.accept();
    this.socket = ws;
    ws.addEventListener("message", (ev) => this.ctx.waitUntil(this.onJetstream(String(ev.data))));
    ws.addEventListener("close", (ev) => {
      log.warn("index: jetstream closed", { code: ev.code });
      this.socket = null;
    });
    ws.addEventListener("error", () => {
      log.warn("index: jetstream error");
      this.socket = null;
    });
  }

  private async onJetstream(text: string) {
    const msg = obj(parseJson(text));
    if (!msg) return;
    const timeUs = num(msg.time_us);
    if (timeUs !== undefined) await this.ctx.storage.put(StorageKey.cursor, timeUs);
    if (msg.kind !== JETSTREAM_COMMIT) return;
    const commit = obj(msg.commit);
    const did = str(msg.did);
    const rkey = str(commit?.rkey);
    if (logEnabled(LogLevel.debug)) {
      log.debug("index: jetstream commit", { did, collection: commit?.collection, op: commit?.operation, rkey });
    }
    if (commit?.collection === NOTE_COLLECTION && did && rkey) {
      if (commit.operation === CommitOp.delete) await removeNote(this.env.DB, did, rkey);
      else await this.upsertNote(did, rkey, commit.record);
      return;
    }
    const change = fromJetstream(msg);
    if (!change) return;
    if (change.op === ChangeOp.delete) await removeRecord(this.env.DB, change.did, change.rkey);
    else await this.upsertListing(change.did, change.rkey, change.event);
  }

  private async upsertNote(did: string, rkey: string, record: unknown) {
    const note = noteFor(did, rkey, record);
    if (note) await putNote(this.env.DB, note, nowSeconds());
  }

  private async upsertListing(did: string, rkey: string, event: unknown) {
    const e = asNostrEvent(event);
    const row = e ? await ingest(this.env.DB, e, nowSeconds(), { did, rkey }) : null;
    if (row) await this.announce(row);
  }

  /** One backfill step per cron tick (state kept between ticks). */
  async backfill() {
    const db = this.env.DB;
    const state = (await this.ctx.storage.get<BackfillState>(StorageKey.backfill)) ?? initialState();
    const { state: next, read } = await backfillStep(state, {
      relay: this.env.RELAY,
      now: nowSeconds(),
      budget: BACKFILL_BUDGET,
      fetchJSON: async (u) => {
        try {
          const r = await fetch(u, { headers: { [Header.accept]: ContentType.json } });
          return r.ok ? await r.json() : null;
        } catch {
          return null;
        }
      },
      upsert: async (collection, did, rkey, record) => {
        if (collection === NOTE_COLLECTION) await this.upsertNote(did, rkey, record);
        else if (isObject(record)) await this.upsertListing(did, rkey, record.event);
      },
      reconcile: async (collection, did, rkeys) => {
        const table = collection === NOTE_COLLECTION ? Table.notes : Table.listings;
        const { results } = await db
          .prepare(`SELECT rkey FROM ${table} WHERE did = ?`)
          .bind(did)
          .all<{ rkey: string | null }>();
        for (const { rkey } of results) {
          if (!rkey || rkeys.includes(rkey)) continue;
          if (table === Table.notes) await removeNote(db, did, rkey);
          else await removeRecord(db, did, rkey);
        }
      },
    });
    await this.ctx.storage.put(StorageKey.backfill, next);
    if (read) log.info("index: backfill step", { repos: read, queued: next.queue.length });
  }

  async backfillStatus() {
    const s = (await this.ctx.storage.get<BackfillState>(StorageKey.backfill)) ?? initialState();
    return { queued: s.queue.length, lastFullPass: s.lastFullAt || null };
  }

  /** Whether the hub is following Jetstream right now (shown by /health). */
  async following(): Promise<boolean> {
    await this.ensureStream();
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /** Open searches: a client sends its filter once; matching new listings are pushed as they're indexed. */
  async fetch(_req: Request): Promise<Response> {
    await this.ensureStream();
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const filter = normalizeFilter(parseJson(String(message)));
    if (filter) ws.serializeAttachment(filter);
    else ws.close(UNSUPPORTED_DATA, "bad filter");
  }

  async announce(row: Row) {
    for (const ws of this.ctx.getWebSockets()) {
      const f = ws.deserializeAttachment() as Filter | null;
      if (f && matches(f, row)) ws.send(row.event);
    }
  }
}
