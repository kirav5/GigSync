import { type JobRecordSubmit, JobSubmitState, type PlaceKey, RecordRefusal, type UserId } from "@gigsync/protocol";
import { householdAgreed } from "../db/agree-signatures.js";
import { type Db, transaction } from "../db/client.js";
import { activeDeviceIds, activeDevices } from "../db/devices.js";
import { dropOneSided, upsertRecord } from "../db/job-records.js";
import { lockEngagement, otherSubmission, saveSubmission, setStates, storedFields } from "../db/job-submissions.js";
import { setQuantities } from "../db/record-quantities.js";
import { columnsOf, fieldsFrom, fieldsText, jobFields } from "./fields.js";
import { mergeQuantities, sameJob } from "./quantities.js";
import { Side, sideOf } from "./sides.js";
import { signingDevice } from "./verify.js";

const S = JobSubmitState.enum;
const differs = { refusal: RecordRefusal.enum.record_differs } as const;

/**
 * What a submission came to: a state for the phone, a refusal (`bad_signature`, `record_differs`), or a counterpart
 * the directory does not know (no active device).
 */
export type Attested = { state: JobSubmitState } | { refusal: RecordRefusal } | { unknownCounterpart: true };

/**
 * Two-party attestation (ADR 0038 §2). The sender's signature must verify against one of their active devices.
 * - The other side's submission has the same fields: the job is stored, attested (both verified on arrival).
 * - It differs: both are set aside as a mismatch, and a one-sided job on the engagement is withdrawn.
 * - It has not arrived: the worker's side is stored as a one-sided job that counts on her record (the household may
 *   never send: it declined the notice), but only once the server delivered the household's own `agree` on this
 *   engagement to her; until then it waits (promoteOnAgree upgrades it when that agree arrives). A household's side
 *   waits, since it alone never makes a job.
 * Either side may submit again until the job is attested; after that, the same fields answer "stored" and different
 * ones are refused.
 */
/** A worker's side may stand alone once the household's agree on this engagement was delivered to her. */
const mayStandAlone = async (db: Db, s: JobRecordSubmit, sender: UserId): Promise<boolean> =>
  sideOf(s.role) === Side.worker && householdAgreed(db, s.engagement, s.counterpart, sender);

export async function attest(
  db: Db,
  sender: UserId,
  s: JobRecordSubmit,
  now: Date,
  fallbackCity: PlaceKey,
): Promise<Attested> {
  const fields = jobFields(sender, s);
  const text = fieldsText(fields);
  const [mineKeys, theirDevices] = await Promise.all([activeDevices(db, sender), activeDeviceIds(db, s.counterpart)]);
  if (theirDevices.length === 0) return { unknownCounterpart: true };
  const device = signingDevice(mineKeys, s.terms_hash, s.sig);
  if (!device) return { refusal: RecordRefusal.enum.bad_signature };
  const mine = { ...s, user: sender, fields: text, device, at: now };
  const sides = [sender, s.counterpart];
  return transaction(db, async (): Promise<Attested> => {
    await lockEngagement(db, s.engagement);
    const stored = await storedFields(db, s.engagement, S.stored);
    if (stored !== undefined) return sameJob(stored, text) ? { state: S.stored } : differs;
    const theirs = await otherSubmission(db, s.engagement, s.counterpart, sender);
    if (theirs && !sameJob(theirs.fields, text)) {
      await dropOneSided(db, s.engagement);
      await saveSubmission(db, mine, S.mismatch);
      await setStates(db, s.engagement, sides, S.mismatch);
      return { state: S.mismatch };
    }
    if (!theirs && !(await mayStandAlone(db, s, sender))) {
      await saveSubmission(db, mine, S.pending);
      return { state: S.pending };
    }
    const attested = theirs !== undefined;
    if (!(await upsertRecord(db, fields, columnsOf(fields.work, fields.terms), attested, now, fallbackCity)))
      return differs;
    const theirQuantities = theirs ? fieldsFrom(theirs.fields).quantities : undefined;
    await setQuantities(db, s.engagement, mergeQuantities(fields.quantities, theirQuantities));
    const state = attested ? S.stored : S.one_sided;
    await saveSubmission(db, mine, state);
    if (attested) await setStates(db, s.engagement, sides, S.stored);
    return { state };
  });
}
