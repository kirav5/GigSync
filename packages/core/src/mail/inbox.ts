import type { Envelope } from "@collab/protocol";
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
    if (e.seq > cursor.last + 1) {
      if (cursor.held.length >= this.holdLimit) cursor.held.shift();
      cursor.held.push(e);
      await this.storage.put(Collection.inboxCursor, key, cursor);
      return { outcome: Outcome.held, waiting_for: cursor.last + 1 };
    }

    const deliver: Envelope[] = [e];
    cursor.last = e.seq;
    cursor.held.sort((a, b) => a.seq - b.seq);
    while (cursor.held[0]?.seq === cursor.last + 1) {
      const next = cursor.held.shift() as Envelope;
      deliver.push(next);
      cursor.last = next.seq;
    }
    await this.storage.put(Collection.inboxCursor, key, cursor);
    return { outcome: Outcome.new, deliver };
  }
}
