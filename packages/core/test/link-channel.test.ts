import type { Envelope } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { Inbox, MemoryStorage, Outbox, Outcome } from "../src/index.js";

const U = "01J0000000000000000000AAAA";
const HOUR_MS = 3600_000;
const now = new Date("2026-10-29T10:00:00+05:30");
const at = (hours: number) => new Date(now.getTime() + hours * HOUR_MS);

/** A note on a mentor link: no job behind it, only the pair's channel id as `engagement`. */
const note = (seq: number, sentAtHours = 0, lifeHours = 1): Envelope => ({
  v: 1,
  id: `msg_${String(seq).padStart(26, "0")}`,
  from: { user: `usr_${U}`, device: `dev_${U}` },
  to: { user: `usr_${U}` },
  engagement: `eng_${U}`,
  seq,
  kind: "colleague_note",
  sent_at: at(sentAtHours).toISOString(),
  expires_at: at(sentAtHours + lifeHours).toISOString(),
  epk: "",
  keys: {},
  ciphertext: "",
  sig: "",
});

const delivered = (r: Awaited<ReturnType<Inbox["accept"]>>) =>
  r.outcome === Outcome.new ? r.deliver.map((e) => e.seq) : r.outcome;

describe("ordering on a mentor link's channel", () => {
  it("numbers and orders a channel that has no job, holding a gap until it fills", async () => {
    const outbox = new Outbox(new MemoryStorage());
    expect([await outbox.nextSeq(`eng_${U}`, `usr_${U}`), await outbox.nextSeq(`eng_${U}`, `usr_${U}`)]).toEqual([
      0, 1,
    ]);
    const inbox = new Inbox(new MemoryStorage());
    expect(delivered(await inbox.accept(note(0), now))).toEqual([0]);
    expect(await inbox.accept(note(2), now)).toEqual({ outcome: Outcome.held, waiting_for: 1 });
    expect(delivered(await inbox.accept(note(1), now))).toEqual([1, 2]);
  });

  it("gives up a gap once the note held behind it is past its expiry: what it waits for expired first", async () => {
    const inbox = new Inbox(new MemoryStorage());
    expect(delivered(await inbox.accept(note(0), now))).toEqual([0]);
    expect(delivered(await inbox.accept(note(2, 0, 1), now))).toEqual(Outcome.held);
    expect(delivered(await inbox.accept(note(3, 1, 4), at(0.5)))).toEqual(Outcome.held);
    // Note 1 was sent before note 2, so by the time note 2 expired, note 1 had expired in the mailbox as well.
    expect(delivered(await inbox.accept(note(4, 2, 4), at(2)))).toEqual([2, 3, 4]);
    expect(delivered(await inbox.accept(note(1), now))).toEqual(Outcome.duplicate);
  });

  it("gives up every gap that can no longer fill, not only the first", async () => {
    const inbox = new Inbox(new MemoryStorage());
    expect(delivered(await inbox.accept(note(0), now))).toEqual([0]);
    expect(delivered(await inbox.accept(note(2, 0, 1), now))).toEqual(Outcome.held);
    expect(delivered(await inbox.accept(note(5, 0.5, 1), now))).toEqual(Outcome.held);
    expect(delivered(await inbox.accept(note(6, 1, 4), at(2)))).toEqual([2, 5, 6]);
  });

  it("keeps at most its limit held, the ones nearest to delivery", async () => {
    const inbox = new Inbox(new MemoryStorage(), 3);
    expect(delivered(await inbox.accept(note(0), now))).toEqual([0]);
    for (const seq of [5, 4, 3, 2]) expect(delivered(await inbox.accept(note(seq), now))).toEqual(Outcome.held);
    expect(delivered(await inbox.accept(note(1), now))).toEqual([1, 2, 3, 4]);
  });
});
