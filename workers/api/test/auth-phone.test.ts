import { createExecutionContext, env } from "cloudflare:test";
import { Session } from "@gigsync/protocol";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index.js";
import { claimsFor, PROJECT, type TestSigner, testSigner } from "./firebase-helpers.js";

/**
 * Sign-in with a Firebase ID token. The routes are called in this isolate, not through SELF, so the stubbed `fetch`
 * stands in for Google's key endpoint.
 */

const device = { signing_key: "c2lnbmluZw==", encryption_key: "ZW5jcnlwdGlvbg==", protocol: 1 };
const configured = { FIREBASE_PROJECT_ID: PROJECT };

function post(path: string, body: unknown, ip: string, bindings: Record<string, unknown> = configured) {
  return Promise.resolve(
    app.fetch(
      new Request(`http://x/v1/auth${path}`, {
        method: "POST",
        headers: { "cf-connecting-ip": ip },
        body: JSON.stringify(body),
      }),
      { ...env, ...bindings },
      createExecutionContext(),
    ),
  );
}

const tokenSignIn = (idToken: string, ip: string, bindings?: Record<string, unknown>) =>
  post("/phone/verify", { id_token: idToken, device }, ip, bindings);

let signer: TestSigner;

beforeAll(async () => {
  signer = await testSigner();
});

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => signer.keysResponse());
});

describe("phone verify", () => {
  it("signs in with a good token, as the same person the code path knows by that number", async () => {
    const phone = "+919811000401";
    const byCode = Session.parse(await (await post("/otp/verify", { phone, code: "000000", device }, "ip-p1")).json());
    const res = await tokenSignIn(await signer.sign(claimsFor(phone, new Date())), "ip-p1");
    expect(res.status).toBe(200);
    const session = Session.parse(await res.json());
    expect(session.user).toBe(byCode.user);
    expect(session.token).not.toBe(byCode.token);
  });

  it("answers 503 when no Firebase project is set", async () => {
    const res = await tokenSignIn(await signer.sign(claimsFor("+919811000402", new Date())), "ip-p2", {
      FIREBASE_PROJECT_ID: "",
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "phone sign-in not set up" });
  });

  it("rejects malformed input", async () => {
    expect((await post("/phone/verify", { id_token: "", device }, "ip-p3")).status).toBe(400);
    expect((await post("/phone/verify", { id_token: "x.y.z" }, "ip-p3")).status).toBe(400);
  });

  it("refuses a token for another project", async () => {
    const claims = claimsFor("+919811000404", new Date(), { aud: "someone-else" });
    const res = await tokenSignIn(await signer.sign(claims), "ip-p4");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "bad token" });
  });

  it("refuses a number locked by wrong codes, even with a good token", async () => {
    const phone = "+919811000405";
    for (let i = 0; i < 5; i++) await post("/otp/verify", { phone, code: "123456", device }, "ip-p5");
    expect((await tokenSignIn(await signer.sign(claimsFor(phone, new Date())), "ip-p5b")).status).toBe(429);
  });

  it("caps attempts per client IP", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await tokenSignIn("a.b.c", "ip-p6")).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
