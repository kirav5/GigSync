import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/index.js";

beforeAll(async () => {
  await applyD1Migrations(env.DIRECTORY, env.TEST_MIGRATIONS);
});

const device = { signing_key: "c2lnbmluZw==", encryption_key: "ZW5jcnlwdGlvbg==", protocol: 1 };

function verify(phone: string, code: string, ip = phone, body: unknown = { phone, code, device }) {
  return SELF.fetch("http://x/v1/auth/otp/verify", {
    method: "POST",
    headers: { "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });
}

const count = async (table: string) =>
  (await env.DIRECTORY.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n ?? 0;

describe("otp verify", () => {
  it("rejects a wrong code", async () => {
    const res = await verify("+919811000001", "123456");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "wrong code" });
  });

  it("locks a number after five wrong codes, even against the right one", async () => {
    const phone = "+919811000002";
    for (let i = 0; i < 5; i++) expect((await verify(phone, "123456")).status).toBe(401);
    expect((await verify(phone, "000000")).status).toBe(429);
  });

  it("forgets wrong codes after a successful sign-in", async () => {
    const phone = "+919811000003";
    for (let i = 0; i < 3; i++) await verify(phone, "123456");
    expect((await verify(phone, "000000")).status).toBe(200);
    // Without the reset these four would make seven failures and lock the number.
    for (let i = 0; i < 4; i++) await verify(phone, "123456");
    expect((await verify(phone, "000000")).status).toBe(200);
  });

  it("caps attempts per client IP", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await verify(`+91981100010${i % 10}`, "123456", "ip-spray")).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("rejects malformed input", async () => {
    const res = await verify("+919811000004", "000000", undefined, {
      phone: "+919811000004",
      code: "000000",
      device: { ...device, signing_key: "" },
    });
    expect(res.status).toBe(400);
  });

  it("writes nothing when part of a sign-up fails", async () => {
    const before = { users: await count("users"), devices: await count("devices") };
    await env.DIRECTORY.exec("ALTER TABLE sessions RENAME TO sessions_off");
    try {
      expect((await verify("+919811000005", "000000")).status).toBe(500);
    } finally {
      await env.DIRECTORY.exec("ALTER TABLE sessions_off RENAME TO sessions");
    }
    expect({ users: await count("users"), devices: await count("devices") }).toEqual(before);
  });

  it("fails safely without the phone HMAC key", async () => {
    const res = await app.request(
      "/v1/auth/otp/verify",
      {
        method: "POST",
        headers: { "cf-connecting-ip": "no-key" },
        body: JSON.stringify({ phone: "+919811000006", code: "000000", device }),
      },
      { ...env, PHONE_HMAC_KEY: undefined },
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal error" });
  });
});
