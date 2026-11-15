import { createExecutionContext, env } from "cloudflare:test";
import { Session } from "@gigsync/protocol";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index.js";
import { claimsFor, PROJECT, type TestSigner, testSigner } from "./firebase-helpers.js";
import { sql } from "./sql.js";

/**
 * Proving a second number (the one linked to an Aadhaar) while signed in with another: the routes are called in this
 * isolate, not through SELF, so the stubbed `fetch` stands in for Google's key endpoint.
 */

const device = { signing_key: "c2lnbmluZw==", encryption_key: "ZW5jcnlwdGlvbg==", protocol: 1 };
const configured = { FIREBASE_PROJECT_ID: PROJECT };
const SECOND = "+919811000599";

function post(path: string, body: unknown, token?: string, bindings: Record<string, unknown> = configured) {
  const headers: Record<string, string> = { "cf-connecting-ip": `ip-${path}-${token ?? ""}` };
  if (token) headers.authorization = `Bearer ${token}`;
  return Promise.resolve(
    app.fetch(
      new Request(`http://x/v1${path}`, { method: "POST", headers, body: JSON.stringify(body) }),
      { ...env, ...bindings },
      createExecutionContext(),
    ),
  );
}

/** Signs a number in by the dev code; returns its session. */
async function signedIn(phone: string): Promise<Session> {
  return Session.parse(await (await post("/auth/otp/verify", { phone, code: "000000", device }, undefined)).json());
}

const sessionsOf = async (user: string) =>
  (await sql<{ token: string }>("SELECT token FROM sessions WHERE user_id = $1 ORDER BY token", [user])).map(
    (r) => r.token,
  );

let signer: TestSigner;

beforeAll(async () => {
  signer = await testSigner();
});

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => signer.keysResponse());
});

describe("phone confirm", () => {
  it("confirms a second number by the dev code without signing in or touching the session", async () => {
    const me = await signedIn("+919811000501");
    const before = await sessionsOf(me.user);
    const usersBefore = await sql("SELECT user_id FROM users");
    const sent = await post("/phone/confirm/request", { phone: SECOND }, me.token);
    expect(sent.status).toBe(200);
    expect(await sent.json()).toEqual({ sent: true, channel: "dev" });
    const res = await post("/phone/confirm", { phone: SECOND, code: "000000" }, me.token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ confirmed: true });
    expect(await sessionsOf(me.user)).toEqual(before);
    expect(await sql("SELECT user_id FROM users")).toHaveLength(usersBefore.length);
  });

  it("refuses a wrong code, and keeps no count of it against the number", async () => {
    const me = await signedIn("+919811000502");
    const attempts = () => sql("SELECT phone_hmac, failures FROM otp_attempts ORDER BY phone_hmac");
    const before = await attempts();
    const res = await post("/phone/confirm", { phone: SECOND, code: "123456" }, me.token);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "wrong code" });
    expect(await attempts()).toEqual(before);
  });

  it("needs a session", async () => {
    expect((await post("/phone/confirm", { phone: SECOND, code: "000000" })).status).toBe(401);
    expect((await post("/phone/confirm/request", { phone: SECOND }, "ses_nobody")).status).toBe(401);
  });

  it("rejects malformed input", async () => {
    const me = await signedIn("+919811000504");
    expect((await post("/phone/confirm/request", { phone: "98110" }, me.token)).status).toBe(400);
    expect((await post("/phone/confirm", { phone: SECOND, code: "12" }, me.token)).status).toBe(400);
    expect((await post("/phone/confirm", { code: "000000" }, me.token)).status).toBe(400);
  });

  it("confirms by a Firebase token for that number, and only that number", async () => {
    const me = await signedIn("+919811000505");
    const good = await signer.sign(claimsFor(SECOND, new Date()));
    expect((await post("/phone/confirm", { phone: SECOND, id_token: good }, me.token)).status).toBe(200);
    const other = await signer.sign(claimsFor("+919811000506", new Date()));
    const res = await post("/phone/confirm", { phone: SECOND, id_token: other }, me.token);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "bad token" });
    expect((await post("/phone/confirm", { phone: SECOND, id_token: "a.b.c" }, me.token)).status).toBe(401);
  });

  it("answers 503 for a token when no Firebase project is set", async () => {
    const me = await signedIn("+919811000507");
    const token = await signer.sign(claimsFor(SECOND, new Date()));
    const res = await post("/phone/confirm", { phone: SECOND, id_token: token }, me.token, { FIREBASE_PROJECT_ID: "" });
    expect(res.status).toBe(503);
  });

  it("caps confirmations per signed-in person", async () => {
    const me = await signedIn("+919811000508");
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++)
      statuses.push((await post("/phone/confirm", { phone: SECOND, code: "123456" }, me.token)).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
