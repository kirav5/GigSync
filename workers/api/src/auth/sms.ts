import { ContentType, Header, HttpMethod } from "@gigsync/core/http";
import type { Env } from "../env.js";

/** Sends a sign-in code to a number by SMS. */
export interface SmsGateway {
  sendCode(phone: string, code: string): Promise<void>;
}

/**
 * MSG91's SendOTP (docs.msg91.com/otp/sendotp), given the code this server made: MSG91 only delivers it, on an OTP
 * template that carries `##OTP##` and is DLT-registered with the sender ID, as Indian SMS must be. The code is still
 * checked here (`codes.ts`); the expiry sent to MSG91 only keeps its own copy from outliving ours.
 */
const MSG91_OTP_URL = "https://control.msg91.com/api/v5/otp";
const AUTH_KEY_HEADER = "authkey";
const SUCCESS = "success";
/** Minutes, matching `CODE_TTL_MS`. */
const OTP_EXPIRY_MINUTES = "5";
const OTP_LENGTH = "6";
const PLUS = "+";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export class SmsError extends Error {}

export function msg91(authKey: string, templateId: string, fetchFn: Fetch = (i, init) => fetch(i, init)): SmsGateway {
  return {
    async sendCode(phone, code) {
      // International format with the country code, which MSG91 takes without the plus.
      const params = new URLSearchParams({
        template_id: templateId,
        mobile: phone.replace(PLUS, ""),
        otp: code,
        otp_length: OTP_LENGTH,
        otp_expiry: OTP_EXPIRY_MINUTES,
      });
      const res = await fetchFn(`${MSG91_OTP_URL}?${params}`, {
        method: HttpMethod.post,
        headers: { [AUTH_KEY_HEADER]: authKey, [Header.contentType]: ContentType.json },
        body: "{}",
      });
      // MSG91 answers 200 for some failures too, saying so in `type`.
      const body = (await res.json().catch(() => null)) as { type?: string; message?: string } | null;
      if (!res.ok || body?.type !== SUCCESS)
        throw new SmsError(`msg91 ${res.status}: ${body?.message ?? "no message"}`);
    },
  };
}

/** The SMS gateway when MSG91's key and OTP template are set as secrets; none otherwise. */
export function smsGateway(env: Env): SmsGateway | undefined {
  const { MSG91_AUTH_KEY, MSG91_OTP_TEMPLATE_ID } = env;
  return MSG91_AUTH_KEY && MSG91_OTP_TEMPLATE_ID ? msg91(MSG91_AUTH_KEY, MSG91_OTP_TEMPLATE_ID) : undefined;
}
