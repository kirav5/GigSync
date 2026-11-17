import { createExecutionContext, env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { newCode } from "../src/auth/codes.js";
import app from "../src/index.js";
import { sql } from "./sql.js";

/** ADR 0069: the API makes the sign-in code, sends it by WhatsApp, and checks it; the dev code stops working. */

const device = { signing_key: "c2lnbmluZw==", encryption_key: "ZW5jcnlwdGlvbg==", protocol: 1 };
const WHATSAPP = {
  WHATSAPP_TOKEN: "test-token",
  WHATSAPP_PHONE_NUMBER_ID: "1234567890",
  WHATSAPP_TEMPLATE: "gigsync_otp",
};

/** A sign-in call with WhatsApp on (or `bindings` instead), from its own client IP so tests never share a cap. */
const call = (path: string, ip: string, body: unknown, bindings: Record<string, unknown> = WHATSAPP) =>
  Promise.resolve(
    app.fetch(
      new Request(`http://x/v1/auth/otp/${path}`, {
        method: "POST",
        headers: { "cf-connecting-ip": ip },
        body: JSON.stringify(body),
      }),
      { ...env, ...bindings },
      createExecutionContext(),
    ),
  );
const request = (phone: string, bindings?: Record<string, unknown>) => call("request", phone, { phone }, bindings);
const verify = (phone: string, code: string) => call("verify", phone, { phone, code, device });

/** Meta's API, answering `status`; the requests it got, to read the code that was sent. */
const meta = (status = 200) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({}, { status }));

interface SentMessage {
  to: string;
  template: { name: string; components: { type: string; parameters: { text: string }[] }[] };
}

/** The message the last send asked Meta for. */
function lastSent(fetched: ReturnType<typeof meta>): { url: string; message: SentMessage } {
  const [url, init] = fetched.mock.calls.at(-1) ?? [];
  return { url: String(url), message: JSON.parse(String(init?.body)) as SentMessage };
}
const codeIn = (message: SentMessage) => message.template.components[0]?.parameters[0]?.text ?? "";

afterEach(() => vi.restoreAllMocks());

describe("WhatsApp sign-in codes", () => {
  it("sends the template with the code in its body and on its button, to the number without its +", async () => {
    const fetched = meta();
    const res = await request("+919822000001");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true, channel: "whatsapp" });
    const { url, message } = lastSent(fetched);
    expect(url).toContain("/1234567890/messages");
    expect(message.to).toBe("919822000001");
    expect(message.template.name).toBe("gigsync_otp");
    expect(codeIn(message)).toMatch(/^\d{6}$/);
    expect(message.template.components[1]?.parameters[0]?.text).toBe(codeIn(message));
  });

  it("signs in with the code it sent, once", async () => {
    const fetched = meta();
    const phone = "+919822000002";
    await request(phone);
    const code = codeIn(lastSent(fetched).message);
    const res = await verify(phone, code);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ token: expect.any(String) });
    expect((await verify(phone, code)).status).toBe(401);
  });

  it("refuses a wrong code and the dev code", async () => {
    meta();
    const phone = "+919822000003";
    await request(phone);
    expect((await verify(phone, "000000")).status).toBe(401);
  });

  it("refuses an expired code", async () => {
    const fetched = meta();
    const phone = "+919822000004";
    await request(phone);
    await sql("UPDATE otp_codes SET expires_at = now() - interval '1 minute'");
    expect((await verify(phone, codeIn(lastSent(fetched).message))).status).toBe(401);
  });

  it("makes a number wait before another code, and caps its codes per hour", async () => {
    meta();
    const phone = "+919822000005";
    expect((await request(phone)).status).toBe(200);
    expect((await request(phone)).status).toBe(429);
    for (let i = 0; i < 4; i++) {
      await sql("UPDATE otp_codes SET sent_at = now() - interval '1 minute'");
      expect((await request(phone)).status).toBe(200);
    }
    await sql("UPDATE otp_codes SET sent_at = now() - interval '1 minute'");
    expect((await request(phone)).status).toBe(429);
  });

  it("answers 502 when Meta refuses, and lets the number ask again at once", async () => {
    meta(400);
    const phone = "+919822000006";
    const res = await request(phone);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "code not sent" });
    meta();
    expect((await request(phone)).status).toBe(200);
  });

  it("without WhatsApp set up, answers with the dev code and sends nothing", async () => {
    const fetched = meta();
    const res = await request("+919822000007", {});
    expect(await res.json()).toEqual({ sent: true, channel: "dev" });
    expect(fetched).not.toHaveBeenCalled();
  });

  it("makes six-digit codes, leading zeros kept", () => {
    for (let i = 0; i < 50; i++) expect(newCode()).toMatch(/^\d{6}$/);
  });
});
