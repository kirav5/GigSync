import { SELF } from "cloudflare:test";
import type { EngagementId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { envelope, post, signIn } from "./people.js";

const area = { lat: 12.97, lon: 77.64 };

describe("api", () => {
  it("reports health", async () => {
    const res = await SELF.fetch("http://x/health");
    expect(await res.json()).toMatchObject({ ok: true, protocol: 1 });
  });

  it("tags every response with a request id, cf-ray when Cloudflare sends one", async () => {
    expect((await SELF.fetch("http://x/health")).headers.get("x-request-id")).toMatch(/.+/);
    const res = await SELF.fetch("http://x/nope", { headers: { "cf-ray": "abc123-BOM" } });
    expect(res.headers.get("x-request-id")).toBe("abc123-BOM");
  });

  it("answers CORS preflight only for allowed origins", async () => {
    const preflight = (origin: string) =>
      SELF.fetch("http://x/v1/inbox", {
        method: "OPTIONS",
        headers: {
          origin,
          "access-control-request-method": "GET",
          "access-control-request-headers": "authorization",
        },
      });
    const app = await preflight("capacitor://localhost");
    expect(app.status).toBe(204);
    expect(app.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
    expect(app.headers.get("access-control-allow-headers")).toContain("authorization");

    const other = await preflight("https://evil.example");
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("signs in two people and routes a sealed, signed envelope between them", async () => {
    const asha = await signIn("+919800000001");
    const mother = await signIn("+919800000002");

    const dir = await asha.api.directory(mother.session.user);
    expect(dir.devices.map((d) => d.device_id)).toEqual([mother.session.device]);

    const e = await envelope(asha, mother, "request", {
      trade: "maid",
      need: "Daily cleaning",
      when: "mornings",
      area,
    });
    expect(await asha.api.deliver(e)).toEqual({ stored: true, devices: 1 });

    const inbox = await mother.api.inbox();
    expect(inbox.map((x) => x.id)).toEqual([e.id]);
    expect(JSON.stringify(inbox)).not.toContain("Daily cleaning");
    expect(await mother.api.ack([e.id])).toEqual({ acked: 1 });
    expect(await mother.api.inbox()).toEqual([]);
  });

  it("refuses an envelope whose content was altered after signing", async () => {
    const a = await signIn("+919800000005");
    const b = await signIn("+919800000006");
    const e = await envelope(a, b, "request", { trade: "maid", need: "Cleaning", when: "today", area });
    expect(await post(a, { ...e, ciphertext: `${e.ciphertext.slice(0, -4)}AAA=` })).toBe(403);
    expect(await post(a, { ...e, seq: 9 })).toBe(403);
    expect(await b.api.inbox()).toEqual([]);
  });

  it("refuses an envelope signed by a different device than the session's", async () => {
    const a = await signIn("+919800000007");
    const b = await signIn("+919800000008");
    const forged = await envelope(a, b, "request", { trade: "maid", need: "x", when: "now", area });
    const other = await signIn("+919800000009");
    // Signed by `other`'s key but claiming a's device: the signature does not match a's registered key.
    const resigned = await envelope(other, b, "request", { trade: "maid", need: "x", when: "now", area });
    expect(await post(a, { ...resigned, from: forged.from })).toBe(403);
    // a's genuine envelope, but sent with b's session.
    expect(await post(b, forged)).toBe(403);
  });

  it("refuses an envelope that claims another sender", async () => {
    const a = await signIn("+919800000003");
    const b = await signIn("+919800000004");
    const e = await envelope(b, b, "request", { trade: "maid", need: "x", when: "now", area });
    expect(await post(a, e)).toBe(403);
  });

  it("rejects requests without a session", async () => {
    expect((await SELF.fetch("http://x/v1/inbox")).status).toBe(401);
    expect((await SELF.fetch("http://x/v1/inbox/claims", { method: "POST", body: "{}" })).status).toBe(401);
  });

  it("gives an engagement to the first of a person's devices that claims it, in their own mailbox only", async () => {
    const phone = await signIn("+919800000010");
    const laptop = await signIn("+919800000010");
    const someoneElse = await signIn("+919800000011");
    expect(laptop.session.user).toBe(phone.session.user);
    const engagement = "eng_01J0000000000000000000E001";
    expect(await laptop.api.claim(engagement)).toBe(laptop.session.device);
    expect(await phone.api.claim(engagement)).toBe(laptop.session.device);
    // Another person's mailbox is their own: the same id is free there.
    expect(await someoneElse.api.claim(engagement)).toBe(someoneElse.session.device);
  });

  it("refuses a claim without an engagement id", async () => {
    const a = await signIn("+919800000012");
    await expect(a.api.claim("not-an-id" as EngagementId)).rejects.toMatchObject({ status: 400 });
  });
});
