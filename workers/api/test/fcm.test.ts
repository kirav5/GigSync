import { SELF } from "cloudflare:test";
import { HttpMethod, t } from "@gigsync/core";
import { Header } from "@gigsync/core/http";
import { EnvelopeKind, type NativePush, type UserId } from "@gigsync/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { wakeAll } from "../src/push/alerts.js";
import { assertionFor, type Fcm, fcmMessage, fcmWake, forgetFcmToken } from "../src/push/fcm.js";
import { Woke } from "../src/push/webpush.js";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";

/**
 * The Android app's alerts by FCM (ADR 0067): the app gives its token and language, and the API sends a notification
 * Android shows itself, "GigSync" and one fixed line in that language, with no data, signed in as the service account.
 */

const NOW = new Date("2026-11-17T10:00:00Z");
const NEWS = { kind: EnvelopeKind.enum.request, from: "usr_01JBQ0000000000000000000AA" as UserId };
const TOKEN = "dQw4w9WgXcQ:APA91bHPRgkF3JUikC4ENAHEeMrd41Zxv3hVZjC9KtT8OvPVGJ";
const PHONE: NativePush = { fcm: TOKEN, lang: "hi" };
const SEND = "https://fcm.googleapis.com/v1/projects/gigsync-test/messages:send";
const GRANTED = { access_token: "ya29.test-token", expires_in: 3600 };

const RSA = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};
const b64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) =>
    c.charCodeAt(0),
  );

/** A service account with a fresh RSA key, as Google's JSON gives it (the key as PEM), and the key to check with. */
async function testAccount(): Promise<{ fcm: Fcm; verifyKey: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey(RSA, true, ["sign", "verify"])) as CryptoKeyPair;
  const der = (await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer;
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64(der).replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`;
  return {
    fcm: { project_id: "gigsync-test", client_email: "alerts@gigsync-test.iam.gserviceaccount.com", private_key: pem },
    verifyKey: pair.publicKey,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.restoreAllMocks();
  forgetFcmToken();
});

describe("the Android app's FCM token", () => {
  it("is kept with its language, and cleared on DELETE", async () => {
    const p = await signIn("+919844400301");
    expect((await call(p, HttpMethod.put, "/devices/me/push", PHONE)).status).toBe(204);
    expect((await call(p, HttpMethod.delete, "/devices/me/push")).status).toBe(204);
  });

  it("is refused with a language the app does not speak, or a token that is not one", async () => {
    const p = await signIn("+919844400302");
    expect((await call(p, HttpMethod.put, "/devices/me/push", { fcm: TOKEN, lang: "fr" })).status).toBe(400);
    expect((await call(p, HttpMethod.put, "/devices/me/push", { fcm: "not a token", lang: "en" })).status).toBe(400);
  });

  it("is refused without a session", async () => {
    const res = await SELF.fetch("http://x/v1/devices/me/push", {
      method: HttpMethod.put,
      body: JSON.stringify(PHONE),
    });
    expect(res.status).toBe(401);
  });
});

describe("an FCM alert", () => {
  it("signs in as the service account, for messaging only, with a token Google can check", async () => {
    const { fcm, verifyKey } = await testAccount();
    const [head, claims, sig] = (await assertionFor(fcm, NOW)).split(".");
    const said = JSON.parse(new TextDecoder().decode(fromB64url(claims ?? "")));
    expect(said).toMatchObject({
      iss: fcm.client_email,
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    });
    expect(said.exp - said.iat).toBe(3600);
    const ok = await crypto.subtle.verify(
      RSA,
      verifyKey,
      fromB64url(sig ?? ""),
      new TextEncoder().encode(`${head}.${claims}`),
    );
    expect(ok).toBe(true);
  });

  it("says only GigSync and one line in the owner's language: no data, one tray line, high priority", () => {
    const { message } = fcmMessage(PHONE);
    expect(message.token).toBe(TOKEN);
    expect(message.notification).toEqual({ title: "GigSync", body: t("hi", "alerts.native_body") });
    expect(message).not.toHaveProperty("data");
    expect(message.android).toMatchObject({ priority: "high", ttl: "86400s", notification: { tag: "gigsync-job" } });
    // In GigSync's colours: the app's sun in the status bar, terracotta.
    expect(message.android.notification).toMatchObject({ icon: "ic_stat_gigsync", color: "#A4512B" });
  });

  it("is sent with the access token Google gave, which is kept for the next one", async () => {
    const { fcm } = await testAccount();
    const fetched = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(GRANTED))
      .mockResolvedValueOnce(json({ name: "projects/gigsync-test/messages/1" }))
      .mockResolvedValueOnce(json({ name: "projects/gigsync-test/messages/2" }));
    expect(await fcmWake(PHONE, fcm, NOW)).toBe(Woke.sent);
    expect(await fcmWake(PHONE, fcm, NOW)).toBe(Woke.sent);
    // One sign-in, two sends.
    expect(fetched).toHaveBeenCalledTimes(3);
    expect(fetched.mock.calls[0]?.[0]).toBe("https://oauth2.googleapis.com/token");
    const [url, init] = fetched.mock.calls[1] ?? [];
    expect(url).toBe(SEND);
    expect(((init?.headers ?? {}) as Record<string, string>)[Header.authorization]).toBe(
      `Bearer ${GRANTED.access_token}`,
    );
  });

  it("says a token is gone when FCM says it is unregistered or not found, and failed otherwise", async () => {
    const { fcm } = await testAccount();
    const unregistered = { error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(GRANTED))
      .mockResolvedValueOnce(json(unregistered, 400))
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(json({ error: { status: "UNAVAILABLE" } }, 503));
    expect(await fcmWake(PHONE, fcm, NOW)).toBe(Woke.gone);
    expect(await fcmWake(PHONE, fcm, NOW)).toBe(Woke.gone);
    expect(await fcmWake(PHONE, fcm, NOW)).toBe(Woke.failed);
  });

  it("fails without sending when Google refuses the sign-in", async () => {
    const { fcm } = await testAccount();
    const fetched = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ error: "invalid_grant" }, 400));
    expect(await fcmWake(PHONE, fcm, NOW)).toBe(Woke.failed);
    expect(fetched).toHaveBeenCalledTimes(1);
  });
});

describe("a job message's alerts", () => {
  it("go to the Android app by FCM and skip a browser while the VAPID keys are not set", async () => {
    const { fcm } = await testAccount();
    const fetched = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(GRANTED))
      .mockResolvedValueOnce(json({ name: "projects/gigsync-test/messages/1" }));
    const web = { endpoint: "https://fcm.googleapis.com/fcm/send/abc123" };
    await wakeAll([PHONE, web], NEWS, { fcm }, NOW, "req-1");
    expect(fetched).toHaveBeenCalledTimes(2);
    expect(fetched.mock.calls[1]?.[0]).toBe(SEND);
  });
});
