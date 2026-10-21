// Pure listing logic, shared by the Worker and the tests: event verification, the fields the index stores, and
// filter → SQL. Nothing here does I/O.
import { schnorr } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

export const LISTING_KIND = 30402;
export const LISTING_COLLECTION = "dev.collab.market.listing";

export interface NostrEvent {
  id: string; pubkey: string; created_at: number; kind: number; tags: string[][]; content: string; sig: string;
}

/** The app's NostrFilter as JSON: {kinds, authors?, tags: {t?: [...], g?: [...]}, since?, limit?, maxPrice?, minPrice?}. */
export interface Filter {
  kinds: number[]; authors?: string[]; tags?: Record<string, string[]>; since?: number; limit?: number;
  /** Budget bounds in the listing's minor-unit amount. A listing with no price still matches (its owner may negotiate). */
  maxPrice?: number; minPrice?: number;
}

export interface Row {
  key: string; id: string; pubkey: string; d: string; did: string | null; rkey: string | null;
  category: string; g4: string; g5: string; g6: string; price: number | null;
  created_at: number; expires_at: number; event: string;
}

const tag = (e: NostrEvent, name: string) => e.tags.find(t => t[0] === name && t.length > 1)?.[1];

/** NIP-01: id = sha256 of the serialized event; sig = Schnorr over the id by pubkey. */
export function isAuthentic(e: NostrEvent): boolean {
  try {
    const serialized = JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]);
    const id = bytesToHex(sha256(new TextEncoder().encode(serialized)));
    return id === e.id && schnorr.verify(e.sig, e.id, e.pubkey);
  } catch { return false; }
}

/** The stored row for a Collab listing, or null if it isn't one, isn't authentic, or isn't live. */
export function rowFor(e: NostrEvent, now: number, origin?: { did: string; rkey: string }): Row | null | "remove" {
  if (e.kind !== LISTING_KIND || !isAuthentic(e)) return null;
  const d = tag(e, "d");
  const category = e.tags.find(t => t[0] === "t" && t[1]?.startsWith("collab-"))?.[1];
  const g = e.tags.filter(t => t[0] === "g" && t.length > 1).map(t => t[1]);
  const g4 = g.find(x => x.length === 4), g5 = g.find(x => x.length === 5), g6 = g.find(x => x.length === 6);
  if (!d || !category || !g4 || !g5 || !g6 || !e.tags.some(t => t[0] === "collab")) return null;
  const expires = Number(tag(e, "expiration") ?? e.created_at + 30 * 86400);
  if (tag(e, "status") !== "active" || expires <= now) return "remove";
  const price = Number(e.tags.find(t => t[0] === "price")?.[1]);
  return {
    key: `${e.pubkey}|${d}`, id: e.id, pubkey: e.pubkey, d, did: origin?.did ?? null, rkey: origin?.rkey ?? null,
    category, g4, g5, g6, price: Number.isFinite(price) ? price : null,
    created_at: e.created_at, expires_at: expires, event: JSON.stringify(e),
  };
}

/** Filter → SQL over the listings table. Area: g values at precision 4–6 match the column of their length. */
export function sqlFor(f: Filter, now: number): { sql: string; args: (string | number)[] } {
  const where: string[] = ["expires_at > ?"]; const args: (string | number)[] = [now];
  if (!f.kinds?.includes(LISTING_KIND)) return { sql: "SELECT event FROM listings WHERE 0", args: [] };
  const t = (f.tags?.t ?? []).filter(x => x.startsWith("collab-"));
  if (t.length) { where.push(`category IN (${t.map(() => "?").join(",")})`); args.push(...t); }
  const g = (f.tags?.g ?? []).filter(x => x.length >= 4 && x.length <= 6);
  if (g.length) {
    const parts: string[] = [];
    for (const n of [4, 5, 6]) {
      const of = g.filter(x => x.length === n);
      if (of.length) { parts.push(`g${n} IN (${of.map(() => "?").join(",")})`); args.push(...of); }
    }
    where.push(`(${parts.join(" OR ")})`);
  }
  if (f.authors?.length) { where.push(`pubkey IN (${f.authors.map(() => "?").join(",")})`); args.push(...f.authors); }
  if (typeof f.maxPrice === "number" && Number.isFinite(f.maxPrice)) { where.push("(price IS NULL OR price <= ?)"); args.push(f.maxPrice); }
  if (typeof f.minPrice === "number" && Number.isFinite(f.minPrice)) { where.push("(price IS NULL OR price >= ?)"); args.push(f.minPrice); }
  if (f.since) { where.push("created_at >= ?"); args.push(f.since); }
  const limit = Math.min(Math.max(f.limit ?? 300, 1), 500);
  return { sql: `SELECT event FROM listings WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ${limit}`, args };
}

/** Does a stored row satisfy an open search (for pushing new listings)? */
export function matches(f: Filter, r: Row): boolean {
  if (!f.kinds?.includes(LISTING_KIND)) return false;
  const t = (f.tags?.t ?? []).filter(x => x.startsWith("collab-"));
  if (t.length && !t.includes(r.category)) return false;
  const g = f.tags?.g ?? [];
  if (g.length && !g.some(x => x === r.g4 || x === r.g5 || x === r.g6)) return false;
  if (f.authors?.length && !f.authors.includes(r.pubkey)) return false;
  if (typeof f.maxPrice === "number" && r.price !== null && r.price > f.maxPrice) return false;
  if (typeof f.minPrice === "number" && r.price !== null && r.price < f.minPrice) return false;
  return true;
}

/** A Jetstream commit for a Collab listing record → what to do with it. */
export function fromJetstream(msg: any): { op: "upsert"; event: NostrEvent; did: string; rkey: string } | { op: "delete"; did: string; rkey: string } | null {
  if (msg?.kind !== "commit" || msg.commit?.collection !== LISTING_COLLECTION) return null;
  const did = msg.did, rkey = msg.commit.rkey;
  if (typeof did !== "string" || typeof rkey !== "string") return null;
  if (msg.commit.operation === "delete") return { op: "delete", did, rkey };
  const event = msg.commit.record?.event;
  if (!event || typeof event !== "object") return null;
  return { op: "upsert", event, did, rkey };
}

/** The app sends `tags: {t: [...]}`; NIP-01 clients send `"#t": [...]`. Both mean the same search, so an unknown
 *  spelling never turns into "everything". */
export function normalizeFilter(raw: any): Filter | null {
  if (!raw || typeof raw !== "object") return null;
  const tags: Record<string, string[]> = { ...(raw.tags ?? {}) };
  for (const [k, v] of Object.entries(raw)) if (k.startsWith("#") && Array.isArray(v)) tags[k.slice(1)] = v as string[];
  const num = (v: any) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  return { kinds: raw.kinds, authors: raw.authors, tags, since: raw.since, limit: raw.limit,
           maxPrice: num(raw.maxPrice), minPrice: num(raw.minPrice) };
}
