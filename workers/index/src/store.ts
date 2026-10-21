// The listing table behind a tiny D1-shaped interface, so the same code runs on Cloudflare D1 and in tests.
import { type Filter, type NostrEvent, type Row, rowFor, sqlFor } from "./listing.ts";

export interface DB {
  prepare(sql: string): { bind(...args: unknown[]): { all(): Promise<{ results: any[] }>; run(): Promise<unknown>; first(): Promise<any> } };
}

export async function ingest(db: DB, e: NostrEvent, now: number, origin?: { did: string; rkey: string }): Promise<Row | null> {
  const r = rowFor(e, now, origin);
  if (r === null) return null;
  const d = e.tags.find(t => t[0] === "d")?.[1];
  const key = `${e.pubkey}|${d}`;
  const held = await db.prepare("SELECT created_at, id FROM listings WHERE key = ?").bind(key).first()
    ?? await db.prepare("SELECT created_at, id FROM tombstones WHERE key = ?").bind(key).first();
  // Newer wins; on a tie, NIP-01's rule: the lower event id. A removal leaves a tombstone, so older copies stay out.
  if (held && (held.created_at > e.created_at || (held.created_at === e.created_at && held.id <= e.id))) return null;
  if (r === "remove") {
    await db.prepare("DELETE FROM listings WHERE key = ?").bind(key).run();
    await db.prepare("INSERT OR REPLACE INTO tombstones (key, created_at, id, removed_at) VALUES (?, ?, ?, ?)").bind(key, e.created_at, e.id, now).run();
    return null;
  }
  await db.prepare("DELETE FROM tombstones WHERE key = ?").bind(key).run();
  await db.prepare(`INSERT OR REPLACE INTO listings (key, id, pubkey, d, did, rkey, category, g4, g5, g6, price, created_at, expires_at, event)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(r.key, r.id, r.pubkey, r.d, r.did, r.rkey, r.category, r.g4, r.g5, r.g6, r.price, r.created_at, r.expires_at, r.event).run();
  return r;
}

export async function removeRecord(db: DB, did: string, rkey: string, now = Math.floor(Date.now() / 1000)) {
  const held = await db.prepare("SELECT key, created_at, id FROM listings WHERE did = ? AND rkey = ?").bind(did, rkey).first();
  if (!held) return;
  await db.prepare("DELETE FROM listings WHERE key = ?").bind(held.key).run();
  await db.prepare("INSERT OR REPLACE INTO tombstones (key, created_at, id, removed_at) VALUES (?, ?, ?, ?)").bind(held.key, held.created_at, held.id, now).run();
}

export async function query(db: DB, f: Filter, now: number): Promise<NostrEvent[]> {
  const { sql, args } = sqlFor(f, now);
  const { results } = await db.prepare(sql).bind(...args).all();
  return results.map(x => JSON.parse(x.event));
}

export async function count(db: DB, now: number): Promise<number> {
  return (await db.prepare("SELECT COUNT(*) AS n FROM listings WHERE expires_at > ?").bind(now).first())?.n ?? 0;
}

export async function prune(db: DB, now: number) {
  await db.prepare("DELETE FROM listings WHERE expires_at <= ?").bind(now).run();
  await db.prepare("DELETE FROM tombstones WHERE removed_at <= ?").bind(now - 30 * 86400).run();
}
