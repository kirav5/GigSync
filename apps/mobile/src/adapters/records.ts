import { RecordsClient } from "@gigsync/core";
import type { Session } from "@gigsync/protocol";
import { AccountError } from "./account.js";
import { API_BASE } from "./api.js";

/** The API's job record routes (ADR 0038), as the signed-in device. */
export function recordsClient(session: Session): RecordsClient {
  if (!API_BASE) throw new AccountError("No API address in this build");
  return new RecordsClient(API_BASE, undefined, session);
}
