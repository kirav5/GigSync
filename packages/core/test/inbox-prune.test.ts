import type { Envelope } from "@gigsync/protocol";
import { DEFAULT_TTL_SECONDS } from "@gigsync/protocol";
import { ulid } from "ulid";
import { describe, expect, it } from "vitest";
import { Collection, Inbox, MemoryStorage, MOVED_COLLECTIONS } from "../src/index.js";

const U = "01J0000000000000000000AAAA";
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const TTL_MS = DEFAULT_TTL_SECONDS.job * 1000;
const start = new Date("2026-10-21T10:00:00+05:30");
const later = (ms: number) => new Date(start.getTime() + ms);

const env = (seq: number, sent: Date): Envelope => ({
  v: 1,
  id: `msg_${ulid(sent.getTime())}`,
  from: { user: `usr_${U}`, device: `dev_${U}` },
  to: { user: `usr_${U}` },
  engagement: `eng_${U}`,
  seq,
  kind: "update",
  sent_at: sent.toISOString(),
  expires_at: new Date(sent.getTime() + TTL_MS).toISOString(),
  ciphertext: "",
  sig: "",
});

describe("pruning seen ids", () => {
  it("deletes ids seen longer ago than an envelope lives, and keeps the rest", async () => {
    const storage = new MemoryStorage();
    const inbox = new Inbox(storage);
    const old = env(0, start);
    const recent = env(1, later(3 * DAY_MS));
    await inbox.accept(old, start);
    await inbox.accept(recent, later(3 * DAY_MS));

    expect(await inbox.prune(later(TTL_MS + HOUR_MS))).toBe(1);
    expect(await storage.ids(Collection.inboxSeen)).toEqual([recent.id]);
    // The pruned envelope is past its expiry, and behind its sender's cursor: it cannot be taken twice.
    expect((await inbox.accept(old, later(TTL_MS + HOUR_MS))).outcome).toBe("expired");
  });

  it("runs at most once a day, also across restarts", async () => {
    const storage = new MemoryStorage();
    const inbox = new Inbox(storage);
    await inbox.accept(env(0, start), start);
    await inbox.accept(env(1, later(HOUR_MS)), later(HOUR_MS));
    const first = later(TTL_MS + HOUR_MS / 2);
    expect(await inbox.prune(first)).toBe(1);

    // The second id is old enough a little later, but the day is not over: not for this object, not for a new one.
    const soon = new Date(first.getTime() + 2 * HOUR_MS);
    expect(await inbox.prune(soon)).toBe(0);
    expect(await new Inbox(storage).prune(soon)).toBe(0);
    expect(await storage.ids(Collection.inboxSeen)).toHaveLength(1);

    expect(await new Inbox(storage).prune(new Date(first.getTime() + DAY_MS))).toBe(1);
    expect(await storage.ids(Collection.inboxSeen)).toEqual([]);
  });

  it("ages a record with no time by its id, and keeps one whose age cannot be told", async () => {
    const storage = new MemoryStorage();
    const oldId = `msg_${ulid(start.getTime())}`;
    const newId = `msg_${ulid(later(TTL_MS).getTime())}`;
    await storage.put(Collection.inboxSeen, oldId, {});
    await storage.put(Collection.inboxSeen, newId, { at: "not a date" });
    await storage.put(Collection.inboxSeen, "not-a-ulid", {});

    expect(await new Inbox(storage).prune(later(TTL_MS + HOUR_MS))).toBe(1);
    expect((await storage.ids(Collection.inboxSeen)).sort()).toEqual([newId, "not-a-ulid"].sort());
  });

  it("keeps when it last pruned on the phone: moved to a new one, it would differ there and ask which to keep", () => {
    expect(MOVED_COLLECTIONS).not.toContain(Collection.inboxSweep);
  });
});
