import { HttpMethod } from "@gigsync/core";
import { EnvelopeKind, type UserId } from "@gigsync/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Vapid, vapidAuthorization, Woke, wake } from "../src/push/webpush.js";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";
import { testPhone } from "./push-phone.js";

/**
 * Web Push notifications: a device gives its push address (only a real push service's) and keys, and the API sends it
 * the news (what kind of message, from whom) encrypted to those keys; to a device without keys, an empty push.
 */

const FCM = "https://fcm.googleapis.com/fcm/send/abc123";
const NOW = new Date("2026-11-01T10:00:00Z");
const NEWS = { kind: EnvelopeKind.enum.update, from: "usr_01JBQ0000000000000000000AA" as UserId };

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

  it("is kept with its keys, and refused with keys that are not base64url", async () => {
    const p = await signIn("+919844400204");
    const { keys } = await testPhone();
    expect((await call(p, HttpMethod.put, "/devices/me/push", { endpoint: FCM, keys })).status).toBe(204);
    const bad = { endpoint: FCM, keys: { p256dh: "not base64!", auth: keys.auth } };
    expect((await call(p, HttpMethod.put, "/devices/me/push", bad)).status).toBe(400);
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

describe("a push, signed with VAPID", () => {
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

  it("carries the news encrypted to the phone, which only the phone can read", async () => {
    const { vapid } = await testVapid();
    const phone = await testPhone();
    const fetched = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 201 }));
    expect(await wake({ endpoint: FCM, keys: phone.keys }, NEWS, vapid, NOW)).toBe(Woke.sent);
    const init = fetched.mock.calls[0]?.[1];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    const body = init?.body as Uint8Array;
    expect(headers["Content-Length"]).toBe(String(body.length));
    // Nothing readable on the wire: not the kind, not the sender.
    const wire = new TextDecoder("latin1").decode(body);
    expect(wire).not.toContain(NEWS.from);
    expect(wire).not.toContain(NEWS.kind);
    expect(JSON.parse(await phone.decrypt(body))).toEqual(NEWS);
  });

  it("is sent empty to a device without keys, says when the address is gone, and never goes elsewhere", async () => {
    const { vapid } = await testVapid();
    const fetched = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 201 }));
    expect(await wake({ endpoint: FCM }, NEWS, vapid, NOW)).toBe(Woke.sent);
    const init = fetched.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["Content-Length"]).toBe("0");
    fetched.mockResolvedValueOnce(new Response(null, { status: 410 }));
    expect(await wake({ endpoint: FCM }, NEWS, vapid, NOW)).toBe(Woke.gone);
    expect(await wake({ endpoint: "https://evil.example/push" }, NEWS, vapid, NOW)).toBe(Woke.failed);
    expect(fetched).toHaveBeenCalledTimes(2);
  });
});
