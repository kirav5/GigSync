// Pure listing logic, shared by the Worker and the tests: event verification, the fields the index stores, and
// filter → SQL. Nothing here does I/O.
import { schnorr } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import {
  CATEGORY_PREFIX,
  CommitOp,
  DEFAULT_LISTING_TTL,
  GEOHASH_LENGTHS,
  JETSTREAM_COMMIT,
  KEY_SEPARATOR,
  LISTING_STATUS_ACTIVE,
  NostrTag,
  REMOVE,
} from "./constants.ts";
import { isObject, num, obj, str, strings } from "./json.ts";

export const LISTING_KIND = 30402;
export const LISTING_COLLECTION = "dev.collab.market.listing";
const DEFAULT_LIMIT = 300;
const MAX_LIMIT = 500;

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/** The app's NostrFilter as JSON: {kinds, authors?, tags: {t?: [...], g?: [...]}, since?, limit?, maxPrice?, minPrice?}. */
export interface Filter {
  kinds: number[];
  authors?: string[] | undefined;
  tags?: Record<string, string[]> | undefined;
  since?: number | undefined;
  limit?: number | undefined;
  /** Budget bounds in the listing's minor-unit amount. A listing with no price still matches (its owner may negotiate). */
  maxPrice?: number | undefined;
  minPrice?: number | undefined;
}

export interface Row {
  key: string;
  id: string;
  pubkey: string;
  d: string;
  did: string | null;
  rkey: string | null;
  category: string;
  g4: string;
  g5: string;
  g6: string;
  price: number | null;
  created_at: number;
  expires_at: number;
  event: string;
}

/** What the index does with a Jetstream commit: creates and updates both upsert. */
export const ChangeOp = { upsert: "upsert", delete: CommitOp.delete } as const;

export type JetstreamChange =
  | { op: typeof ChangeOp.upsert; event: NostrEvent; did: string; rkey: string }
  | { op: typeof ChangeOp.delete; did: string; rkey: string };

const tag = (e: NostrEvent, name: string) => e.tags.find((t) => t[0] === name && t.length > 1)?.[1];
const tagValues = (e: NostrEvent, name: string) =>
  e.tags.filter((t) => t[0] === name && t.length > 1).map((t) => t[1] as string);
/** `?, ?, ?` for an IN list of n values. */
const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(", ");
const isCategory = (t: string) => t.startsWith(CATEGORY_PREFIX);

export const listingKey = (pubkey: string, d: string | undefined) => `${pubkey}${KEY_SEPARATOR}${d}`;

/** The event if it has every NIP-01 field with the right type; signature checks come later, in rowFor. */
export function asNostrEvent(v: unknown): NostrEvent | null {
  if (!isObject(v)) return null;
  const { id, pubkey, created_at, kind, tags, content, sig } = v;
  const tagsOk = Array.isArray(tags) && tags.every((t) => Array.isArray(t) && t.every((x) => typeof x === "string"));
  if (!str(id) || !str(pubkey) || num(created_at) === undefined || num(kind) === undefined) return null;
  if (!tagsOk || typeof content !== "string" || !str(sig)) return null;
  return v as unknown as NostrEvent;
}

/** NIP-01: id = sha256 of the serialized event; sig = Schnorr over the id by pubkey. */
export function isAuthentic(e: NostrEvent): boolean {
  try {
    const serialized = JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]);
    const id = bytesToHex(sha256(new TextEncoder().encode(serialized)));
    return id === e.id && schnorr.verify(e.sig, e.id, e.pubkey);
  } catch {
    return false;
  }
}

/** The stored row for a Collab listing, or null if it isn't one, isn't authentic, or isn't live. */
export function rowFor(e: NostrEvent, now: number, origin?: { did: string; rkey: string }): Row | null | typeof REMOVE {
  if (e.kind !== LISTING_KIND || !isAuthentic(e)) return null;
  const d = tag(e, NostrTag.identifier);
  const category = tagValues(e, NostrTag.topic).find(isCategory);
  const g = tagValues(e, NostrTag.geohash);
  const [g4, g5, g6] = GEOHASH_LENGTHS.map((n) => g.find((x) => x.length === n));
  if (!d || !category || !g4 || !g5 || !g6 || !e.tags.some((t) => t[0] === NostrTag.collab)) return null;
  const expires = Number(tag(e, NostrTag.expiration) ?? e.created_at + DEFAULT_LISTING_TTL);
  if (tag(e, NostrTag.status) !== LISTING_STATUS_ACTIVE || expires <= now) return REMOVE;
  const price = Number(e.tags.find((t) => t[0] === NostrTag.price)?.[1]);
  return {
    key: listingKey(e.pubkey, d),
    id: e.id,
    pubkey: e.pubkey,
    d,
    did: origin?.did ?? null,
    rkey: origin?.rkey ?? null,
    category,
    g4,
    g5,
    g6,
    price: Number.isFinite(price) ? price : null,
    created_at: e.created_at,
    expires_at: expires,
    event: JSON.stringify(e),
  };
}

/** Filter → SQL over the listings table. Area: g values at precision 4–6 match the column of their length. */
export function sqlFor(f: Filter, now: number): { sql: string; args: (string | number)[] } {
  const where: string[] = ["expires_at > ?"];
  const args: (string | number)[] = [now];
  if (!f.kinds?.includes(LISTING_KIND)) return { sql: "SELECT event FROM listings WHERE 0", args: [] };
  const t = (f.tags?.[NostrTag.topic] ?? []).filter(isCategory);
  if (t.length) {
    where.push(`category IN (${placeholders(t.length)})`);
    args.push(...t);
  }
  const g = f.tags?.[NostrTag.geohash] ?? [];
  const parts: string[] = [];
  for (const n of GEOHASH_LENGTHS) {
    const of = g.filter((x) => x.length === n);
    if (of.length) {
      parts.push(`g${n} IN (${placeholders(of.length)})`);
      args.push(...of);
    }
  }
  if (parts.length) where.push(`(${parts.join(" OR ")})`);
  if (f.authors?.length) {
    where.push(`pubkey IN (${placeholders(f.authors.length)})`);
    args.push(...f.authors);
  }
  if (f.maxPrice !== undefined) {
    where.push("(price IS NULL OR price <= ?)");
    args.push(f.maxPrice);
  }
  if (f.minPrice !== undefined) {
    where.push("(price IS NULL OR price >= ?)");
    args.push(f.minPrice);
  }
  if (f.since) {
    where.push("created_at >= ?");
    args.push(f.since);
  }
  const limit = Math.min(Math.max(f.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  return {
    sql: `SELECT event FROM listings WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ${limit}`,
    args,
  };
}

/** Does a stored row satisfy an open search (for pushing new listings)? */
export function matches(f: Filter, r: Row): boolean {
  if (!f.kinds?.includes(LISTING_KIND)) return false;
  const t = (f.tags?.[NostrTag.topic] ?? []).filter(isCategory);
  if (t.length && !t.includes(r.category)) return false;
  const g = f.tags?.[NostrTag.geohash] ?? [];
  if (g.length && !g.some((x) => x === r.g4 || x === r.g5 || x === r.g6)) return false;
  if (f.authors?.length && !f.authors.includes(r.pubkey)) return false;
  if (f.maxPrice !== undefined && r.price !== null && r.price > f.maxPrice) return false;
  if (f.minPrice !== undefined && r.price !== null && r.price < f.minPrice) return false;
  return true;
}

/** A Jetstream commit for a Collab listing record → what to do with it. */
export function fromJetstream(msg: unknown): JetstreamChange | null {
  if (!isObject(msg) || msg.kind !== JETSTREAM_COMMIT) return null;
  const commit = obj(msg.commit);
  if (commit?.collection !== LISTING_COLLECTION) return null;
  const did = str(msg.did);
  const rkey = str(commit.rkey);
  if (!did || !rkey) return null;
  if (commit.operation === CommitOp.delete) return { op: ChangeOp.delete, did, rkey };
  const event = asNostrEvent(obj(commit.record)?.event);
  return event ? { op: ChangeOp.upsert, event, did, rkey } : null;
}

/** The app sends `tags: {t: [...]}`; NIP-01 clients send `"#t": [...]`. Both mean the same search, so an unknown
 *  spelling never turns into "everything". */
export function normalizeFilter(raw: unknown): Filter | null {
  if (!isObject(raw) || !Array.isArray(raw.kinds)) return null;
  const tags: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(obj(raw.tags) ?? {})) tags[k] = strings(v);
  for (const [k, v] of Object.entries(raw)) if (k.startsWith("#") && Array.isArray(v)) tags[k.slice(1)] = strings(v);
  return {
    kinds: raw.kinds.filter((k): k is number => typeof k === "number"),
    authors: Array.isArray(raw.authors) ? strings(raw.authors) : undefined,
    tags,
    since: num(raw.since),
    limit: num(raw.limit),
    maxPrice: num(raw.maxPrice),
    minPrice: num(raw.minPrice),
  };
}
