import { EnvelopeKind, JobRecordStatus, type JobStatusChange } from "@gigsync/protocol";
import { apply } from "../engagement/machine.js";
import { stamped } from "../job/history.js";
import { UNDER_WAY } from "../job/progress.js";
import type { JobRecord, JobStore } from "../job/store.js";
import { log } from "../log.js";
import { allMyRecords } from "./export.js";
import type { RecordsApi } from "./types.js";

/**
 * Keeping a job in step through GigSync's record when its messages cannot flow. A phone that rebuilt a job from the
 * record cannot carry on its encrypted thread (the counters and signatures never went to the server), so it ends the
 * job on the record instead (`endRestored`, sent by the records runner like any outcome), and the other phone follows
 * the record (`followRecord`). Only ever forward: the record never moves a job back.
 */

const K = EnvelopeKind.enum;
const R = JobRecordStatus.enum;

/** How a restored job can end from its own phone: as the record can end it. */
export type RestoredEnd = JobStatusChange["status"];

/** Statuses a job is still under way in: the record may still finish or cancel it. */

export class RestoredJobError extends Error {}

/** The engagement move each record outcome stands for. */
const MOVE: Readonly<Record<RestoredEnd, EnvelopeKind>> = { [R.done]: K.delivery, [R.cancelled]: K.cancel };

/** The job moved as the record outcome says, stamped; undefined when it is not under way any more. */
function ended(r: JobRecord, end: RestoredEnd, now: Date): JobRecord | undefined {
  if (!UNDER_WAY.has(r.engagement.status)) return undefined;
  return stamped({ ...r, engagement: apply(r.engagement, MOVE[end], now) }, now.toISOString());
}

/** Marks a restored job done or cancelled on this phone; the records runner then tells GigSync's record. */
export async function endRestored(store: JobStore, job: JobRecord, end: RestoredEnd, now: Date): Promise<JobRecord> {
  if (!job.restored) throw new RestoredJobError("only a restored job ends through the record");
  const moved = ended(job, end, now);
  if (!moved) throw new RestoredJobError("the job is not under way");
  const next = { ...moved, restored: { ...job.restored, ended: end } };
  await store.saveJob(next);
  return next;
}

/** What a restored job's phone owes the record: how it ended it from its own card, if it did. */
export const restoredOutcome = (job: JobRecord): JobStatusChange | undefined =>
  job.restored?.ended ? { status: job.restored.ended } : undefined;

/**
 * Moves this phone's jobs forward where the record says the other side finished or cancelled them: the case where
 * that side's phone could not send its message (it rebuilt the job from the record). Returns how many moved.
 */
export async function followRecord(api: Pick<RecordsApi, "myJobRecords">, store: JobStore, now: Date): Promise<number> {
  let moved = 0;
  for (const rec of await allMyRecords(api)) {
    const end = rec.status;
    if (end !== R.done && end !== R.cancelled) continue;
    const local = await store.job(rec.engagement);
    const next = local && ended(local, end, now);
    if (!next) continue;
    await store.saveJob(next);
    moved += 1;
  }
  if (moved > 0) log.info("jobs moved on from the record", { jobs: moved });
  return moved;
}
