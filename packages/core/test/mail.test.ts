import type { Envelope } from "@collab/protocol";
import { describe, expect, it } from "vitest";
import { Inbox, MemoryStorage, Outbox } from "../src/index.js";

const U = "01J0000000000000000000AAAA";
const now = new Date("2026-10-21T10:00:00+05:30");
/** Digits are valid Crockford base32, so a zero-padded number makes a well-formed test ULID. */
const env = (seq: number, id = seq): Envelope => ({
  v: 1,
  id: `msg_${String(id).padStart(26, "0")}`,
  from: { user: `usr_${U}`, device: `dev_${U}` },
  to: { user: `usr_${U}` },
  engagement: `eng_${U}`,
  seq,
  kind: "update",
  sent_at: now.toISOString(),
  expires_at: new Date(now.getTime() + 3600_000).toISOString(),
  ciphertext: "",
  sig: "",
});

describe("inbox", () => {
  it("delivers in order, holds gaps, drops duplicates", async () => {
    const inbox = new Inbox(new MemoryStorage());
    expect((await inbox.accept(env(0), now)).outcome).toBe("new");
    expect(await inbox.accept(env(2), now)).toEqual({ outcome: "held", waiting_for: 1 });
    const r = await inbox.accept(env(1), now);
    expect(r.outcome).toBe("new");
    if (r.outcome === "new") expect(r.deliver.map((e) => e.seq)).toEqual([1, 2]);
    expect((await inbox.accept(env(1), now)).outcome).toBe("duplicate");
  });
  it("refuses expired envelopes", async () => {
    const inbox = new Inbox(new MemoryStorage());
    const late = new Date(now.getTime() + 2 * 3600_000);
    expect((await inbox.accept(env(0), late)).outcome).toBe("expired");
  });
});

describe("outbox", () => {
  it("retries with backoff and hands out sequence numbers", async () => {
    const outbox = new Outbox(new MemoryStorage());
    const e = env(0);
    await outbox.enqueue(e, now);
    expect((await outbox.due(now)).length).toBe(1);
    await outbox.failed(e.id, now);
    expect((await outbox.due(now)).length).toBe(0);
    expect((await outbox.due(new Date(now.getTime() + 2100))).length).toBe(1);
    await outbox.sent(e.id);
    expect((await outbox.due(new Date(now.getTime() + 9999))).length).toBe(0);
    expect(await outbox.nextSeq("eng_x", "usr_y")).toBe(0);
    expect(await outbox.nextSeq("eng_x", "usr_y")).toBe(1);
  });
});
