import type { RecordsDeleted } from "@gigsync/protocol";
import type { Storage } from "../ports.js";
import { withdrawRecords } from "./consent.js";
import { forgetSentRecords } from "./send.js";
import type { RecordsApi } from "./types.js";

/**
 * "Delete my records from GigSync" (ADR 0038 §5): the server removes the owner's rows and their agreement; this phone
 * then stops sending and forgets what it had sent, so agreeing again later sends the record afresh. The jobs on the
 * phone stay.
 */
export async function deleteMyRecords(api: RecordsApi, storage: Storage): Promise<RecordsDeleted> {
  const deleted = await api.deleteRecords();
  await withdrawRecords(storage);
  await forgetSentRecords(storage);
  return deleted;
}
