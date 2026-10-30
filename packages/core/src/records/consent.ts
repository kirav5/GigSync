import { RECORDS_NOTICE_VERSION } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";
import type { RecordsApi } from "./types.js";

/**
 * The notice about job records and the owner's agreement to it (ADR 0038 §5). Nothing about a job is sent before the
 * owner agreed. The server holds the agreement, so a new phone knows it; this phone keeps a copy to decide offline.
 */

/** Where the owner stands with the notice, as this phone last knew it. */
export const RecordsAnswer = { agreed: "agreed", withdrawn: "withdrawn" } as const;
export type RecordsAnswer = (typeof RecordsAnswer)[keyof typeof RecordsAnswer];

interface StoredAnswer {
  answer: RecordsAnswer;
  /** The notice's version when they answered; a newer notice is asked again. */
  version: string;
}

const ANSWER_KEY = "records_consent";

const stored = (storage: Storage) => storage.get<StoredAnswer>(Collection.ownerSettings, ANSWER_KEY);
const save = (storage: Storage, answer: RecordsAnswer) =>
  storage.put<StoredAnswer>(Collection.ownerSettings, ANSWER_KEY, { answer, version: RECORDS_NOTICE_VERSION });

/** The owner agreed to the notice shown now, as this phone knows. */
export async function recordsAgreed(storage: Storage): Promise<boolean> {
  const s = await stored(storage);
  return s?.answer === RecordsAnswer.agreed && s.version === RECORDS_NOTICE_VERSION;
}

/** The owner agrees: the server first, so a failed call leaves the phone asking again. */
export async function agreeToRecords(api: RecordsApi, storage: Storage): Promise<void> {
  await api.acceptConsent();
  await save(storage, RecordsAnswer.agreed);
}

/**
 * Whether to show the notice on opening the app: not when this phone or the server knows the owner agreed to it, nor
 * after they deleted their records (Privacy offers it again). Server unreachable and no answer here: shown, since
 * agreeing then fails and is asked again.
 */
export async function noticeDue(api: RecordsApi, storage: Storage): Promise<boolean> {
  const s = await stored(storage);
  if (s?.answer === RecordsAnswer.withdrawn || (await recordsAgreed(storage))) return false;
  try {
    const consent = await api.consent();
    if (!consent?.current) return true;
    await save(storage, RecordsAnswer.agreed);
    return false;
  } catch {
    return true;
  }
}

/** The server no longer holds this owner's agreement (deleted from another phone, or a newer notice): ask again. */
export function forgetAgreement(storage: Storage): Promise<void> {
  return storage.delete(Collection.ownerSettings, ANSWER_KEY);
}

/** After deleting their records: nothing is sent again until the owner agrees again from Privacy. */
export function withdrawRecords(storage: Storage): Promise<void> {
  return save(storage, RecordsAnswer.withdrawn);
}
