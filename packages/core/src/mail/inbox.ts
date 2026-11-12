import { DEFAULT_TTL_SECONDS, type Envelope } from "@gigsync/protocol";
import { decodeTime } from "ulid";
import { Collection, type Storage } from "../ports.js";

export const Outcome = { new: "new", duplicate: "duplicate", expired: "expired", held: "held" } as const;

export type Accepted =
  | { outcome: typeof Outcome.new; deliver: Envelope[] }
  | { outcome: typeof Outcome.duplicate }
  | { outcome: typeof Outcome.expired }
  | { outcome: typeof Outcome.held; waiting_for: number };

/** What `inbox_seen` keeps per envelope id: when this phone finished with it. */
interface Seen {
  at?: string;
}

const MS_PER_SECOND = 1000;
/**
 * How long a seen id is kept. It only matters while its envelope could come again, and the mailbox drops an envelope
 * at its expiry, which `offer` refuses too: the longest lifetime a sender gives one. An envelope that outlived this
 * (a sender with its own, longer expiry) is still caught by its sender's cursor, which never goes back.
 */
const SEEN_KEPT_MS = DEFAULT_TTL_SECONDS.job * MS_PER_SECOND;
/** Seen ids are pruned at most this often: a pass reads every one of them. */
const SEEN_PRUNE_EVERY_MS = 24 * 60 * 60 * MS_PER_SECOND;
/** The one record of `inbox_sweep`: `{ at }`, when the last pass ran. */
const SWEEP_ID = "seen";
/** Every envelope id is `msg_<ULID>`, and a ULID starts with the time it was made. */
const ULID_LENGTH = 26;

/** When an id was seen: what its record says, or for a record with no readable time, when its envelope was made. */
function seenAt(id: string, seen: Seen | undefined): number | undefined {
  const at = Date.parse(seen?.at ?? "");
  if (Number.isFinite(at)) return at;
  try {
    return decodeTime(id.slice(-ULID_LENGTH));
  } catch {
    return undefined;
  }
}

interface Cursor {
  /** Last sequence number delivered for this (engagement, sender). */
  last: number;
  held: Envelope[];
}

/**
 * At-least-once delivery means duplicates and reordering happen. The inbox drops ids it has seen, delivers in
 * `seq` order per (engagement, sender), and holds anything that arrives early until the gap is filled.
 * Verification of the signature happens before this, in the transport adapter.
 *
 * The key is only a channel id and a sender, so channels with no job behind them (a mentor link) order the same way.
 * Those live for months, so a gap that can never fill must not hold them forever: an envelope sent before a held one
 * expired before it too, so once a held envelope is past its own expiry, whatever it waits for is gone from the
 * mailbox and delivery resumes from it.
 */
export class Inbox {
  /** When `inbox_seen` was last pruned, as far as this object has read; NaN until it has, and when it never was. */
  private sweptAt = Number.NaN;

  constructor(
    private storage: Storage,
    private holdLimit = 50,
  ) {}

  /** A clock set back counts as due too: better one pass too many than none until the clock catches up. */
  private pruneDue(now: Date): boolean {
    return !(Math.abs(now.getTime() - this.sweptAt) < SEEN_PRUNE_EVERY_MS);
  }

  /**
   * Deletes seen ids older than an envelope can live, at most once a day; without it `inbox_seen` grows by one record
   * per message for as long as the phone is used. An id whose age cannot be told is kept. Returns how many went.
   */
  async prune(now: Date): Promise<number> {
    if (!this.pruneDue(now)) return 0;
    const last = await this.storage.get<Seen>(Collection.inboxSweep, SWEEP_ID);
    this.sweptAt = Date.parse(last?.at ?? "");
    if (!this.pruneDue(now)) return 0;
    const cutoff = now.getTime() - SEEN_KEPT_MS;
    const ids = await this.storage.ids(Collection.inboxSeen);
    const ages = await Promise.all(
      ids.map(async (id) => ({ id, at: seenAt(id, await this.storage.get<Seen>(Collection.inboxSeen, id)) })),
    );
    const old = ages.filter((seen) => seen.at !== undefined && seen.at < cutoff);
    await Promise.all(old.map((seen) => this.storage.delete(Collection.inboxSeen, seen.id)));
    await this.storage.put<Seen>(Collection.inboxSweep, SWEEP_ID, { at: now.toISOString() });
    this.sweptAt = now.getTime();
    return old.length;
  }

  /**
   * Takes an envelope in without delivering it: what it hands back is ready, in order, and stays offered again until
   * `delivered` says each one was handled. A crash or a failed open in between loses nothing (architecture review
   * row 2): the envelope is still held here and still in the mailbox, since nothing was acknowledged.
   */
  async offer(e: Envelope, now: Date): Promise<Accepted> {
    if (Date.parse(e.expires_at) <= now.getTime()) return { outcome: Outcome.expired };
    if (await this.storage.get(Collection.inboxSeen, e.id)) return { outcome: Outcome.duplicate };
    const key = keyOf(e);
    const cursor = (await this.storage.get<Cursor>(Collection.inboxCursor, key)) ?? { last: -1, held: [] };
    if (e.seq <= cursor.last) return { outcome: Outcome.duplicate };
    if (!cursor.held.some((h) => h.id === e.id)) cursor.held.push(e);
    cursor.held.sort((a, b) => a.seq - b.seq);
    const deliver = drain({ last: cursor.last, held: [...cursor.held] }, now);
    // A sender this far ahead is broken; what stays held is what is nearest to being delivered.
    cursor.held.splice(deliver.length + this.holdLimit);
    await this.storage.put(Collection.inboxCursor, key, cursor);
    if (deliver.length === 0) return { outcome: Outcome.held, waiting_for: cursor.last + 1 };
    return { outcome: Outcome.new, deliver };
  }

  /** An envelope `offer` handed back was handled, or can never be: it is seen, and its sender's order moves past it. */
  async delivered(e: Envelope, now: Date): Promise<void> {
    await this.storage.put(Collection.inboxSeen, e.id, { at: now.toISOString() });
    const key = keyOf(e);
    const cursor = (await this.storage.get<Cursor>(Collection.inboxCursor, key)) ?? { last: -1, held: [] };
    cursor.held = cursor.held.filter((h) => h.id !== e.id);
    cursor.last = Math.max(cursor.last, e.seq);
    await this.storage.put(Collection.inboxCursor, key, cursor);
  }

  /** `offer` with everything it hands back counted as delivered at once: for callers with nothing that can fail. */
  async accept(e: Envelope, now: Date): Promise<Accepted> {
    const accepted = await this.offer(e, now);
    if (accepted.outcome === Outcome.new) for (const ready of accepted.deliver) await this.delivered(ready, now);
    return accepted;
  }
}

const keyOf = (e: Envelope): string => `${e.engagement}|${e.from.user}`;

/**
 * Takes the held envelopes that are next in order off the cursor (held sorted by seq), giving up each gap whose first
 * held envelope is past its expiry (see Inbox).
 */
function drain(cursor: Cursor, now: Date): Envelope[] {
  const out: Envelope[] = [];
  for (let next = cursor.held[0]; next; next = cursor.held[0]) {
    const dead = next.seq > cursor.last + 1 && Date.parse(next.expires_at) <= now.getTime();
    if (next.seq !== cursor.last + 1 && !dead) break;
    out.push(next);
    cursor.held.shift();
    cursor.last = next.seq;
  }
  return out;
}
