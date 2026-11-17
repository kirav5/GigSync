import { OtpChannel, type Phone } from "@gigsync/protocol";
import type { Env } from "../env.js";
import { SmsError, smsGateway } from "./sms.js";
import { sendCode, whatsAppConfig } from "./whatsapp.js";

/**
 * The ways the API can send a sign-in code it made itself (ADR 0069), in the order it tries them: WhatsApp first (it
 * costs a fraction of an SMS), then an SMS through MSG91. Each is on only when its settings are; none set means the
 * API sends no codes and sign-in is Firebase's SMS or the dev code, as before.
 */
export interface CodeSender {
  channel: OtpChannel;
  /** True when the provider took the code; false when it refused, so the next sender can try. */
  send(phone: Phone, code: string): Promise<boolean>;
}

export function codeSenders(env: Env): CodeSender[] {
  const senders: CodeSender[] = [];
  const whatsApp = whatsAppConfig(env);
  if (whatsApp)
    senders.push({
      channel: OtpChannel.enum.whatsapp,
      send: async (phone, code) => (await sendCode(whatsApp, phone, code)) === undefined,
    });
  const sms = smsGateway(env);
  if (sms)
    senders.push({
      channel: OtpChannel.enum.sms,
      async send(phone, code) {
        try {
          await sms.sendCode(phone, code);
          return true;
        } catch (err) {
          if (err instanceof SmsError) return false;
          throw err;
        }
      },
    });
  return senders;
}
