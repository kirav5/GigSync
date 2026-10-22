// The listing table behind a tiny D1-shaped interface, so the same code runs on Cloudflare D1 and in tests.
import { DEFAULT_LISTING_TTL, NostrTag, REMOVE } from "./constants.ts";
import { type Filter, listingKey, type NostrEvent, type Row, rowFor, sqlFor } from "./listing.ts";

export interface DB {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      all<T = unknown>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
      first<T = unknown>(): Promise<T | null>;
    };
  };
}

/** The version of a listing the index already holds (live or removed), to decide whether a new copy is newer. */
interface Held {
  key: string;
  created_at: number;
  id: string;
}
interface CountRow {
  n: number;
}
interface EventRow {
  event: string;
}

export async function ingest(
  db: DB,
  e: NostrEvent,
  now: number,
  origin?: { did: string; rkey: string },
): Promise<Row | null> {
  const r = rowFor(e, now, origin);
  if (r === null) return null;
  const key = listingKey(e.pubkey, e.tags.find((t) => t[0] === NostrTag.identifier)?.[1]);
  const held =
    (await db.prepare("SELECT key, created_at, id FROM listings WHERE key = ?").bind(key).first<Held>()) ??
    (await db.prepare("SELECT key, created_at, id FROM tombstones WHERE key = ?").bind(key).first<Held>());
  // Newer wins; on a tie, NIP-01's rule: the lower event id. A removal leaves a tombstone, so older copies stay out.
  if (held && (held.created_at > e.created_at || (held.created_at === e.created_at && held.id <= e.id))) return null;
  if (r === REMOVE) {
    await tombstone(db, { key, created_at: e.created_at, id: e.id }, now);
    return null;
  }
  await db.prepare("DELETE FROM tombstones WHERE key = ?").bind(key).run();
  await db
    .prepare(
      `INSERT OR REPLACE INTO listings (key, id, pubkey, d, did, rkey, category, g4, g5, g6, price, created_at, expires_at, event)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      r.key,
      r.id,
      r.pubkey,
      r.d,
      r.did,
      r.rkey,
      r.category,
      r.g4,
      r.g5,
      r.g6,
      r.price,
      r.created_at,
      r.expires_at,
      r.event,
    )
    .run();
  return r;
}

/** Drops a listing and remembers it, so an older copy arriving later cannot bring it back. */
async function tombstone(db: DB, held: Held, now: number) {
  await db.prepare("DELETE FROM listings WHERE key = ?").bind(held.key).run();
  await db
    .prepare("INSERT OR REPLACE INTO tombstones (key, created_at, id, removed_at) VALUES (?, ?, ?, ?)")
    .bind(held.key, held.created_at, held.id, now)
    .run();
}

export async function removeRecord(db: DB, did: string, rkey: string, now = Math.floor(Date.now() / 1000)) {
  const held = await db
    .prepare("SELECT key, created_at, id FROM listings WHERE did = ? AND rkey = ?")
    .bind(did, rkey)
    .first<Held>();
  if (held) await tombstone(db, held, now);
}

export async function query(db: DB, f: Filter, now: number): Promise<NostrEvent[]> {
  const { sql, args } = sqlFor(f, now);
  const { results } = await db
    .prepare(sql)
    .bind(...args)
    .all<EventRow>();
  return results.map((x) => JSON.parse(x.event));
}

export async function count(db: DB, now: number): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM listings WHERE expires_at > ?").bind(now).first<CountRow>();
  return row?.n ?? 0;
}

export async function prune(db: DB, now: number) {
  await db.prepare("DELETE FROM listings WHERE expires_at <= ?").bind(now).run();
  await db
    .prepare("DELETE FROM tombstones WHERE removed_at <= ?")
    .bind(now - DEFAULT_LISTING_TTL)
    .run();
}
