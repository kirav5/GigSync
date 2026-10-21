import type { Envelope } from "@collab/protocol";
import type { Storage } from "../ports.js";

export type Accepted =
  | { outcome: "new"; deliver: Envelope[] }
  | { outcome: "duplicate" }
  | { outcome: "expired" }
  | { outcome: "held"; waiting_for: number };

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
    if (Date.parse(e.expires_at) <= now.getTime()) return { outcome: "expired" };
    if (await this.storage.get("inbox_seen", e.id)) return { outcome: "duplicate" };
    await this.storage.put("inbox_seen", e.id, { at: now.toISOString() });

    const key = `${e.engagement}|${e.from.user}`;
    const cursor = (await this.storage.get<Cursor>("inbox_cursor", key)) ?? { last: -1, held: [] };

    if (e.seq <= cursor.last) return { outcome: "duplicate" };
    if (e.seq > cursor.last + 1) {
      if (cursor.held.length >= this.holdLimit) cursor.held.shift();
      cursor.held.push(e);
      await this.storage.put("inbox_cursor", key, cursor);
      return { outcome: "held", waiting_for: cursor.last + 1 };
    }

    const deliver: Envelope[] = [e];
    cursor.last = e.seq;
    cursor.held.sort((a, b) => a.seq - b.seq);
    while (cursor.held[0]?.seq === cursor.last + 1) {
      const next = cursor.held.shift() as Envelope;
      deliver.push(next);
      cursor.last = next.seq;
    }
    await this.storage.put("inbox_cursor", key, cursor);
    return { outcome: "new", deliver };
  }
}
