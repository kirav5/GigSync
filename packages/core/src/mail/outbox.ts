import type { Envelope, MessageId } from "@collab/protocol";
import type { Storage } from "../ports.js";

export interface Pending {
  envelope: Envelope;
  attempts: number;
  next_attempt_at: string;
}

/**
 * Durable queue of envelopes the phone still has to hand to the mailbox. Survives the app being killed mid-send;
 * retries with backoff; the mailbox dedupes by envelope id so a retry never doubles a message.
 */
export class Outbox {
  constructor(private storage: Storage) {}

  async enqueue(envelope: Envelope, now: Date) {
    await this.storage.put<Pending>("outbox", envelope.id, {
      envelope,
      attempts: 0,
      next_attempt_at: now.toISOString(),
    });
  }

  async due(now: Date): Promise<Pending[]> {
    const all = await this.storage.list<Pending>("outbox");
    return all
      .filter((p) => Date.parse(p.next_attempt_at) <= now.getTime())
      .sort((a, b) => a.envelope.id.localeCompare(b.envelope.id));
  }

  async sent(id: MessageId) {
    await this.storage.delete("outbox", id);
  }

  /** 2s, 4s, 8s … capped at 10 minutes. */
  async failed(id: MessageId, now: Date) {
    const p = await this.storage.get<Pending>("outbox", id);
    if (!p) return;
    const attempts = p.attempts + 1;
    const delayMs = Math.min(2 ** attempts * 1000, 10 * 60 * 1000);
    await this.storage.put<Pending>("outbox", id, {
      ...p,
      attempts,
      next_attempt_at: new Date(now.getTime() + delayMs).toISOString(),
    });
  }

  /** Per (engagement, recipient) sequence numbers, so receivers can order and detect gaps. */
  async nextSeq(engagement: string, to: string): Promise<number> {
    const key = `${engagement}|${to}`;
    const cur = (await this.storage.get<{ seq: number }>("outbox_seq", key))?.seq ?? -1;
    await this.storage.put("outbox_seq", key, { seq: cur + 1 });
    return cur + 1;
  }
}
