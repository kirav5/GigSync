import type { Envelope } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";

export const Outcome = { new: "new", duplicate: "duplicate", expired: "expired", held: "held" } as const;

export type Accepted =
  | { outcome: typeof Outcome.new; deliver: Envelope[] }
  | { outcome: typeof Outcome.duplicate }
  | { outcome: typeof Outcome.expired }
  | { outcome: typeof Outcome.held; waiting_for: number };

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
 * The key is only a channel id and a sender, so channels with no job behind them (two colleagues) order the same way.
 * Those live for months, so a gap that can never fill must not hold them forever: an envelope sent before a held one
 * expired before it too, so once a held envelope is past its own expiry, whatever it waits for is gone from the
 * mailbox and delivery resumes from it.
 */
export class Inbox {
  constructor(
    private storage: Storage,
    private holdLimit = 50,
  ) {}

  async accept(e: Envelope, now: Date): Promise<Accepted> {
    if (Date.parse(e.expires_at) <= now.getTime()) return { outcome: Outcome.expired };
    if (await this.storage.get(Collection.inboxSeen, e.id)) return { outcome: Outcome.duplicate };
    await this.storage.put(Collection.inboxSeen, e.id, { at: now.toISOString() });

    const key = `${e.engagement}|${e.from.user}`;
    const cursor = (await this.storage.get<Cursor>(Collection.inboxCursor, key)) ?? { last: -1, held: [] };
    if (e.seq <= cursor.last) return { outcome: Outcome.duplicate };

    cursor.held.push(e);
    cursor.held.sort((a, b) => a.seq - b.seq);
    const deliver = drain(cursor, now);
    // A sender this far ahead is broken; what stays held is what is nearest to being delivered.
    cursor.held.splice(this.holdLimit);
    await this.storage.put(Collection.inboxCursor, key, cursor);
    if (deliver.length === 0) return { outcome: Outcome.held, waiting_for: cursor.last + 1 };
    return { outcome: Outcome.new, deliver };
  }
}

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
