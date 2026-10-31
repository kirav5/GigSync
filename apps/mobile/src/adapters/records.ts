import { agreeToRecords, log, ownerPorts, type Ports, RecordsClient } from "@gigsync/core";
import type { Session } from "@gigsync/protocol";
import { type Account, AccountError } from "./account.js";
import { API_BASE } from "./api.js";

/** The API's job record routes (ADR 0038), as the signed-in device. */
export function recordsClient(session: Session): RecordsClient {
  if (!API_BASE) throw new AccountError("No API address in this build");
  return new RecordsClient(API_BASE, undefined, session);
}

/**
 * Continuing on the sign-in screen is agreeing to the Terms and Privacy Notice (ADR 0039 §4): recorded on the server
 * and, as the owner's answer, on this phone. Not reached now, it is recorded on the next open instead.
 */
export async function agreeAtSignIn(ports: Ports, account: Account): Promise<void> {
  try {
    await agreeToRecords(recordsClient(account.session), ownerPorts(ports, account.session.user).storage);
  } catch (err) {
    log.warn("agreement at sign-in not recorded", { error: err instanceof Error ? err.name : typeof err });
  }
}
