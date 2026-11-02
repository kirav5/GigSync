import { env, SELF } from "cloudflare:test";
import type { DeviceId, Envelope } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";

const U = "01J0000000000000000000AAAA";
/** Digits are valid Crockford base32, so a zero-padded number makes a well-formed test ULID. */
const envelope = (n: number): Envelope => ({
  v: 1,
  id: `msg_${String(n).padStart(26, "0")}`,
  from: { user: `usr_${U}`, device: `dev_${U}` },
  to: { user: "usr_01J0000000000000000000BBBB" },
  engagement: `eng_${U}`,
  seq: n,
  kind: "request",
  sent_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  epk: "ZXBr",
  keys: { dev_01J0000000000000000000D001: "a2V5" },
  ciphertext: "aGVsbG8=",
  sig: "c2ln",
});
const d1: DeviceId = "dev_01J0000000000000000000D001";
const d2: DeviceId = "dev_01J0000000000000000000D002";

describe("Mailbox durable object", () => {
  it("stores once per device, dedupes, hands out, and forgets on ack", async () => {
    const box = env.MAILBOX.get(env.MAILBOX.idFromName("usr_test_1"));

    expect(await box.deliver({ envelope: envelope(1), devices: [d1, d2] })).toEqual({ stored: true, devices: 2 });
    expect(await box.deliver({ envelope: envelope(1), devices: [d1, d2] })).toEqual({ stored: false, devices: 0 });
    expect(await box.pending()).toBe(2);

    const forD1 = await box.fetchFor(d1);
    expect(forD1.map((e) => e.seq)).toEqual([1]);

    expect(
      await box.ack(
        d1,
        forD1.map((e) => e.id),
      ),
    ).toBe(1);
    expect(await box.fetchFor(d1)).toHaveLength(0);
    expect(await box.fetchFor(d2)).toHaveLength(1);
  });

  it("lets the first device to claim an engagement keep it", async () => {
    const box = env.MAILBOX.get(env.MAILBOX.idFromName("usr_test_4"));
    const job = `eng_${U}` as const;
    const other = "eng_01J0000000000000000000CCCC" as const;
    expect(await box.claim(job, d2)).toBe(d2);
    expect(await box.claim(job, d1)).toBe(d2);
    expect(await box.claim(job, d2)).toBe(d2);
    expect(await box.claim(other, d1)).toBe(d1);
  });

  it("refuses an already-expired envelope", async () => {
    const box = env.MAILBOX.get(env.MAILBOX.idFromName("usr_test_2"));
    const stale = { ...envelope(2), expires_at: new Date(Date.now() - 1000).toISOString() };
    expect(await box.deliver({ envelope: stale, devices: [d1] })).toEqual({ stored: false, devices: 0 });
  });

  it("serves the HTTP surface", async () => {
    const res = await SELF.fetch("http://x/mailbox/usr_test_3/deliver", {
      method: "POST",
      body: JSON.stringify({ envelope: envelope(3), devices: [d1] }),
    });
    expect(await res.json()).toEqual({ stored: true, devices: 1 });
    const got = await SELF.fetch(`http://x/mailbox/usr_test_3/fetch?device=${d1}`);
    expect(((await got.json()) as unknown[]).length).toBe(1);
  });
});
