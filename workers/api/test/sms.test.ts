import { describe, expect, it } from "vitest";
import { msg91, SmsError } from "../src/auth/sms.js";

/** MSG91's SendOTP, with this server's own code (docs.msg91.com/otp/sendotp). */
describe("sending a sign-in code through MSG91", () => {
  const answer = (status: number, body: unknown) => Promise.resolve(Response.json(body, { status }));

  it("posts the number without its plus, the code, the template and a five-minute expiry, with the authkey", async () => {
    const calls: { url: string; init?: RequestInit | undefined }[] = [];
    const gateway = msg91("key-1", "tpl-1", (url, init) => {
      calls.push({ url, init });
      return answer(200, { type: "success", request_id: "abc" });
    });
    await gateway.sendCode("+919845012345", "042917");
    const url = new URL(calls[0]?.url ?? "");
    expect(`${url.origin}${url.pathname}`).toBe("https://control.msg91.com/api/v5/otp");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      template_id: "tpl-1",
      mobile: "919845012345",
      otp: "042917",
      otp_length: "6",
      otp_expiry: "5",
    });
    expect(calls[0]?.init?.headers).toMatchObject({ authkey: "key-1" });
  });

  it("fails on an error MSG91 reports with 200, and on a refused key", async () => {
    const said = msg91("key-1", "bad", () => answer(200, { type: "error", message: "Template ID is incorrect" }));
    await expect(said.sendCode("+919845012345", "042917")).rejects.toThrow(SmsError);
    const refused = msg91("", "tpl-1", () => answer(401, { message: "Authkey is not entered" }));
    await expect(refused.sendCode("+919845012345", "042917")).rejects.toThrow("msg91 401");
  });
});
