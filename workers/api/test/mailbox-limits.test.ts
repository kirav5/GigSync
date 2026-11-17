import { HttpMethod } from "@gigsync/core";
import { MAX_CIPHERTEXT_CHARS, MAX_REQUESTS_PER_DAY } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { envelope, signIn } from "./people.js";

/** Architecture review rows 4 and 10: a copy only where it can be opened, and no envelope of any size. */
describe("delivery", () => {
  it("leaves out a device added after the sender sealed, which could not open it", async () => {
    const asha = await signIn("+919844800001");
    const ravi = await signIn("+919844800002");
    const e = await envelope(asha, ravi, "update", { text: "on the way" });
    const later = await signIn("+919844800002");
    expect(await asha.api.deliver(e)).toEqual({ stored: true, devices: 1 });
    expect((await ravi.api.inbox()).map((m) => m.id)).toEqual([e.id]);
    expect(await later.api.inbox()).toEqual([]);
  });

  it("refuses an envelope sealed only to a device the person no longer has", async () => {
    const asha = await signIn("+919844800003");
    const old = await signIn("+919844800004");
    const e = await envelope(asha, old, "update", { text: "on the way" });
    // A new phone retires the old one, as it does once a move to it is done (ADR 0037 §3).
    const now = await signIn("+919844800004");
    expect((await call(now, HttpMethod.delete, `/devices/${old.session.device}`)).status).toBe(204);
    const res = await call(asha, HttpMethod.post, `/mailbox/${old.session.user}`, e);
    expect(res.status).toBe(409);
    expect(await now.api.inbox()).toEqual([]);
  });

  it("refuses an envelope too large to store, before reading it", async () => {
    const asha = await signIn("+919844800005");
    const ravi = await signIn("+919844800006");
    const e = await envelope(asha, ravi, "update", { text: "on the way" });
    const huge = { ...e, ciphertext: "A".repeat(MAX_CIPHERTEXT_CHARS + 32 * 1024) };
    expect((await call(asha, HttpMethod.post, `/mailbox/${ravi.session.user}`, huge)).status).toBe(413);
  });
});

/** Agreed 2026-11-18: a household asks at most MAX_REQUESTS_PER_DAY workers in 24 hours. */
describe("requests a day", () => {
  it("refuses a household's requests past the day's cap, lets the same one through again, and counts nothing else", async () => {
    const lata = await signIn("+919844810001");
    const ravi = await signIn("+919844810002");
    let last = await envelope(lata, ravi, "request", { text: "need a plumber" });
    for (let i = 0; i < MAX_REQUESTS_PER_DAY; i++) {
      last = await envelope(lata, ravi, "request", { text: "need a plumber" });
      expect((await call(lata, HttpMethod.post, `/mailbox/${ravi.session.user}`, last)).status).toBe(201);
    }
    const over = await envelope(lata, ravi, "request", { text: "need a plumber" });
    expect((await call(lata, HttpMethod.post, `/mailbox/${ravi.session.user}`, over)).status).toBe(429);
    // A request sent again after a dropped connection is the same one, not one more.
    expect((await call(lata, HttpMethod.post, `/mailbox/${ravi.session.user}`, last)).status).toBe(200);
    // Everything else about a job still goes.
    const update = await envelope(lata, ravi, "update", { text: "on the way" });
    expect((await call(lata, HttpMethod.post, `/mailbox/${ravi.session.user}`, update)).status).toBe(201);
  });
});
