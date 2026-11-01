import { HttpMethod } from "@gigsync/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Vapid, vapidAuthorization, Woke, wake } from "../src/push/webpush.js";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";

/** Web Push wake-ups: a device gives its push address (only a real push service's), and the API signs empty pushes. */

const FCM = "https://fcm.googleapis.com/fcm/send/abc123";
const NOW = new Date("2026-11-01T10:00:00Z");

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) =>
    c.charCodeAt(0),
  );

async function testVapid(): Promise<{ vapid: Vapid; verifyKey: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const raw = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const { d } = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return {
    vapid: { publicKey: b64url(raw), privateKey: d ?? "", subject: "mailto:ops@gigsync.network" },
    verifyKey: pair.publicKey,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("a device's push address", () => {
  it("is kept for a real push service and cleared on DELETE", async () => {
    const p = await signIn("+919844400201");
    expect((await call(p, HttpMethod.put, "/devices/me/push", { endpoint: FCM })).status).toBe(204);
    expect((await call(p, HttpMethod.delete, "/devices/me/push")).status).toBe(204);
  });

  it("is refused for any other address, so the API never sends to one of a caller's choosing", async () => {
    const p = await signIn("+919844400202");
    for (const endpoint of ["https://evil.example/push", "http://fcm.googleapis.com/x", "not a url"]) {
      expect((await call(p, HttpMethod.put, "/devices/me/push", { endpoint })).status, endpoint).toBe(400);
    }
  });

  it("has no public key to subscribe with while push is not set up", async () => {
    const p = await signIn("+919844400203");
    const res = await call(p, HttpMethod.get, "/devices/push-key");
    expect(await res.json()).toEqual({});
  });
});

describe("an empty push, signed with VAPID", () => {
  it("carries a token for the push service's origin, signed by the API's key, and the public key", async () => {
    const { vapid, verifyKey } = await testVapid();
    const header = await vapidAuthorization(FCM, vapid, NOW);
    const [, token, key] = header.match(/^vapid t=([^,]+), k=(.+)$/) ?? [];
    expect(key).toBe(vapid.publicKey);
    const [head, claims, sig] = (token ?? "").split(".");
    const body = JSON.parse(new TextDecoder().decode(fromB64url(claims ?? "")));
    expect(body).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: NOW.getTime() / 1000 + 12 * 3600,
      sub: vapid.subject,
    });
    const signed = new TextEncoder().encode(`${head}.${claims}`);
    expect(
      await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, verifyKey, fromB64url(sig ?? ""), signed),
    ).toBe(true);
  });

  it("is sent empty to a push service, says when the address is gone, and never goes elsewhere", async () => {
    const { vapid } = await testVapid();
    const fetched = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 201 }));
    expect(await wake(FCM, vapid, NOW)).toBe(Woke.sent);
    const init = fetched.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["Content-Length"]).toBe("0");
    fetched.mockResolvedValueOnce(new Response(null, { status: 410 }));
    expect(await wake(FCM, vapid, NOW)).toBe(Woke.gone);
    expect(await wake("https://evil.example/push", vapid, NOW)).toBe(Woke.failed);
    expect(fetched).toHaveBeenCalledTimes(2);
  });
});
