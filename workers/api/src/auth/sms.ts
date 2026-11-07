import type { Env } from "../env.js";

/** Sends a sign-in code to a number by SMS. */
export interface SmsGateway {
  sendCode(phone: string, code: string): Promise<void>;
}

/**
 * The SMS gateway, once one is chosen. India requires the sender and the message template to be registered on DLT
 * before a text is delivered, so this waits on that registration as much as on code.
 */
// TODO(M0): an Indian provider (MSG91 or similar) with a DLT-registered sender and template, from secrets in `env`.
export function smsGateway(_env: Env): SmsGateway | undefined {
  return undefined;
}
