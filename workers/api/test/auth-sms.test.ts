import { createExecutionContext, env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/index.js";

/** ADR 0069: MSG91's SMS as a sender of the API's own codes, alone or after WhatsApp. */

const device = { signing_key: "c2lnbmluZw==", encryption_key: "ZW5jcnlwdGlvbg==", protocol: 1 };
const SMS = { MSG91_AUTH_KEY: "test-msg91-key", MSG91_OTP_TEMPLATE_ID: "test-template" };
const WHATSAPP = {
  WHATSAPP_TOKEN: "test-token",
  WHATSAPP_PHONE_NUMBER_ID: "1234567890",
  WHATSAPP_TEMPLATE: "gigsync_otp",
};
const MSG91_HOST = "control.msg91.com";

const call = (path: string, ip: string, body: unknown, bindings: Record<string, unknown>) =>
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

/** Meta answering `metaStatus` and MSG91 answering `smsType`; the URLs asked, to read what was sent where. */
function providers(metaStatus = 200, smsType = "success") {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) =>
      String(input).includes(MSG91_HOST)
        ? Response.json({ type: smsType, message: smsType })
        : Response.json({}, { status: metaStatus }),
    );
}
const smsCode = (fetched: ReturnType<typeof providers>) => {
  const sent = fetched.mock.calls.map(([url]) => new URL(String(url))).find((u) => u.host === MSG91_HOST);
  return sent?.searchParams.get("otp") ?? "";
};

afterEach(() => vi.restoreAllMocks());

describe("sign-in codes by SMS through MSG91", () => {
  it("sends the API's own code by SMS, which signs in once, and the dev code does not", async () => {
    const fetched = providers();
    const phone = "+919833000001";
    const res = await call("request", phone, { phone }, SMS);
    expect(await res.json()).toEqual({ sent: true, channel: "sms" });
    const code = smsCode(fetched);
    expect(code).toMatch(/^\d{6}$/);
    expect((await call("verify", phone, { phone, code: "000000", device }, SMS)).status).toBe(401);
    expect((await call("verify", phone, { phone, code, device }, SMS)).status).toBe(200);
    expect((await call("verify", phone, { phone, code, device }, SMS)).status).toBe(401);
  });

  it("goes by SMS when WhatsApp refuses the code", async () => {
    const fetched = providers(400);
    const phone = "+919833000002";
    const res = await call("request", phone, { phone }, { ...WHATSAPP, ...SMS });
    expect(await res.json()).toEqual({ sent: true, channel: "sms" });
    expect(smsCode(fetched)).toMatch(/^\d{6}$/);
  });

  it("prefers WhatsApp when both are set", async () => {
    const fetched = providers();
    const phone = "+919833000003";
    const res = await call("request", phone, { phone }, { ...WHATSAPP, ...SMS });
    expect(await res.json()).toEqual({ sent: true, channel: "whatsapp" });
    expect(smsCode(fetched)).toBe("");
  });

  it("answers 502 when no provider takes the code", async () => {
    providers(400, "error");
    const phone = "+919833000004";
    const res = await call("request", phone, { phone }, { ...WHATSAPP, ...SMS });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "code not sent" });
  });
});
