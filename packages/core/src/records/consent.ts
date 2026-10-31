import { RECORDS_NOTICE_VERSION } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";
import type { RecordsApi } from "./types.js";

/**
 * The owner's agreement to GigSync's Terms and Privacy Notice, which cover job records (ADR 0039 §4, replacing ADR 0038
 * §5's notice screen): given by continuing on the sign-in screen. Nothing about a job is sent before the owner agreed.
 * The server holds the agreement, so a new phone knows it; this phone keeps a copy to decide offline.
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

/** What opening the app did about the agreement: just recorded it, found it already given, or left it withdrawn. */
export const ConsentOnOpen = { recorded: "recorded", kept: "kept", withdrawn: "withdrawn" } as const;
export type ConsentOnOpen = (typeof ConsentOnOpen)[keyof typeof ConsentOnOpen];

/**
 * On opening the app: an owner signed in before the sign-in line existed (or whose agreement predates the current
 * notice) agreed by using GigSync, so it is recorded once, without a screen; the caller says so in one line. Not after
 * they deleted their records (Privacy offers it again). Throws when GigSync cannot be reached: tried on the next open.
 */
export async function consentOnOpen(api: RecordsApi, storage: Storage): Promise<ConsentOnOpen> {
  if ((await stored(storage))?.answer === RecordsAnswer.withdrawn) return ConsentOnOpen.withdrawn;
  if (await recordsAgreed(storage)) return ConsentOnOpen.kept;
  if ((await api.consent())?.current) {
    await save(storage, RecordsAnswer.agreed);
    return ConsentOnOpen.kept;
  }
  await agreeToRecords(api, storage);
  return ConsentOnOpen.recorded;
}

/**
 * GigSync refused a record for want of a current agreement. With none held at all, the owner deleted their records on
 * another phone: this one stops too, as if deleted here. With an older one held, a newer notice came: forgotten, so the
 * next open records it. Unreachable now: nothing changes, and the next refusal asks again.
 */
export async function lostAgreement(api: RecordsApi, storage: Storage): Promise<void> {
  let held: Awaited<ReturnType<RecordsApi["consent"]>>;
  try {
    held = await api.consent();
  } catch {
    return;
  }
  if (held) await storage.delete(Collection.ownerSettings, ANSWER_KEY);
  else await withdrawRecords(storage);
}

/** After deleting their records: nothing is sent again until the owner agrees again from Privacy. */
export function withdrawRecords(storage: Storage): Promise<void> {
  return save(storage, RecordsAnswer.withdrawn);
}
