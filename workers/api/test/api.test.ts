import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await applyD1Migrations(env.DIRECTORY, env.TEST_MIGRATIONS);
});

const device = { signing_key: "c2lnbmluZw==", encryption_key: "ZW5jcnlwdGlvbg==", protocol: 1 };

async function signIn(phone: string) {
  const res = await SELF.fetch("http://x/v1/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code: "000000", device }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { user: string; device: string; token: string };
}

describe("api", () => {
  it("reports health", async () => {
    const res = await SELF.fetch("http://x/health");
    expect(await res.json()).toMatchObject({ ok: true, protocol: 1 });
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

  it("signs in two people and routes an envelope between them", async () => {
    const asha = await signIn("+919800000001");
    const mother = await signIn("+919800000002");

    const dir = await SELF.fetch(`http://x/v1/directory/${mother.user}`, {
      headers: { authorization: `Bearer ${asha.token}` },
    });
    expect(dir.status).toBe(200);

    const envelope = {
      v: 1,
      id: "msg_01J0000000000000000000M001",
      from: { user: asha.user, device: asha.device },
      to: { user: mother.user },
      engagement: "eng_01J0000000000000000000E001",
      seq: 0,
      kind: "request",
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      ciphertext: "aGVsbG8=",
      sig: "c2ln",
    };
    const sent = await SELF.fetch(`http://x/v1/mailbox/${mother.user}`, {
      method: "POST",
      headers: { authorization: `Bearer ${asha.token}` },
      body: JSON.stringify(envelope),
    });
    expect(sent.status).toBe(201);

    const inbox = await SELF.fetch("http://x/v1/inbox", { headers: { authorization: `Bearer ${mother.token}` } });
    const list = (await inbox.json()) as { id: string }[];
    expect(list.map((e) => e.id)).toEqual([envelope.id]);

    const ack = await SELF.fetch("http://x/v1/inbox/ack", {
      method: "POST",
      headers: { authorization: `Bearer ${mother.token}` },
      body: JSON.stringify({ ids: [envelope.id] }),
    });
    expect(await ack.json()).toEqual({ acked: 1 });
  });

  it("refuses an envelope that claims another sender", async () => {
    const a = await signIn("+919800000003");
    const b = await signIn("+919800000004");
    const res = await SELF.fetch(`http://x/v1/mailbox/${b.user}`, {
      method: "POST",
      headers: { authorization: `Bearer ${a.token}` },
      body: JSON.stringify({
        v: 1,
        id: "msg_01J0000000000000000000M002",
        from: { user: b.user, device: b.device },
        to: { user: b.user },
        engagement: "eng_01J0000000000000000000E002",
        seq: 0,
        kind: "request",
        sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
        ciphertext: "",
        sig: "",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects requests without a session", async () => {
    expect((await SELF.fetch("http://x/v1/inbox")).status).toBe(401);
  });
});
