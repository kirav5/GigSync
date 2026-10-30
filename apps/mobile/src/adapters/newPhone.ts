import { NewPhoneClient } from "@gigsync/core";
import type { Session } from "@gigsync/protocol";
import { AccountError } from "./account.js";
import { API_BASE } from "./api.js";

/** The API's routes for a new phone (moving to it, refilling a card), as the signed-in device. */
export function newPhoneClient(session: Session): NewPhoneClient {
  if (!API_BASE) throw new AccountError("No API address in this build");
  return new NewPhoneClient(API_BASE, undefined, session);
}
