import { JobSubmitState, type Payment, RecordRefusal } from "@gigsync/protocol";
import type { JobRecord } from "../job/store.js";
import { log } from "../log.js";
import { HttpError } from "../net/errors.js";
import { Collection, type Storage } from "../ports.js";
import { lostAgreement, recordsAgreed } from "./consent.js";
import { fingerprint, type RecordReport, ReportKind, recordsDue } from "./due.js";
import type { RecordsApi } from "./types.js";

/** What the server said to one fact: accepted, or refused for good (it will not take it however often it is sent). */
interface Answered {
  fingerprint: string;
  refused?: true;
}

/**
 * Answers that mean the server will never take this fact as it is: a bad body, a signature no active device of the
 * owner's verifies, a job stored with other fields, not the owner's to send, or a job already ended otherwise.
 */
const BAD_REQUEST = 400;
const R = RecordRefusal.enum;
const REFUSALS: ReadonlySet<string> = new Set([
  R.bad_signature,
  R.record_differs,
  R.households_only,
  R.workers_only,
  R.wrong_status,
]);
const refusedForGood = (err: HttpError) => err.status === BAD_REQUEST || REFUSALS.has(err.error);

/** What happened to one fact: taken, refused for good, or to try again later (and the job's later facts with it). */
const Outcome = { taken: "taken", refused: "refused", later: "later" } as const;
type Outcome = (typeof Outcome)[keyof typeof Outcome];
const ORDER: readonly ReportKind[] = [ReportKind.job, ReportKind.status, ReportKind.payment, ReportKind.stars];

export interface RecordsDeps {
  api: RecordsApi;
  storage: Storage;
}

/**
 * The facts still to send: owed now (`recordsDue`) and not yet answered by the server as they are. A fact whose content
 * changed since (a payment confirmed after it was paid, stars changed) is due again and replaces the server's.
 */
export async function pendingRecords(
  storage: Storage,
  jobs: readonly JobRecord[],
  payments: readonly Payment[],
): Promise<RecordReport[]> {
  const due = recordsDue(jobs, payments);
  const answered = await Promise.all(due.map((r) => storage.get<Answered>(Collection.recordsSent, r.id)));
  const rows = due.map((report, i) => ({
    report,
    answer: answered[i],
    current: answered[i]?.fingerprint === fingerprint(report),
  }));
  // A job the server will never store, as it stands: nothing that follows it goes either.
  const refusedJobs = new Set(
    rows
      .filter((row) => row.report.kind === ReportKind.job && row.current && row.answer?.refused)
      .map((row) => row.report.engagement),
  );
  return rows.filter((row) => !row.current && !refusedJobs.has(row.report.engagement)).map((row) => row.report);
}

async function sendOne(api: RecordsApi, r: RecordReport): Promise<void> {
  switch (r.kind) {
    case ReportKind.job: {
      const { state } = await api.submitJob(r.body);
      // Kept aside by the server, never counted: the two phones hold different facts (logged to find out why).
      if (state === JobSubmitState.enum.mismatch)
        log.warn("job record differs from the other side's", { engagement: r.engagement });
      return;
    }
    case ReportKind.status:
      return api.reportStatus(r.engagement, r.body);
    case ReportKind.payment:
      return api.reportPayment(r.engagement, r.body);
    case ReportKind.stars:
      return api.reportStars(r.engagement, r.body);
  }
}

async function attempt(deps: RecordsDeps, r: RecordReport): Promise<Outcome> {
  try {
    await sendOne(deps.api, r);
    await deps.storage.put<Answered>(Collection.recordsSent, r.id, { fingerprint: fingerprint(r) });
    return Outcome.taken;
  } catch (err) {
    if (err instanceof HttpError && err.error === R.no_consent) {
      // The server holds no current agreement: deleted on another phone, or a newer notice.
      await lostAgreement(deps.api, deps.storage);
      return Outcome.later;
    }
    if (err instanceof HttpError && refusedForGood(err)) {
      log.warn("job record refused", { kind: r.kind, engagement: r.engagement, error: err.error });
      await deps.storage.put<Answered>(Collection.recordsSent, r.id, { fingerprint: fingerprint(r), refused: true });
      return Outcome.refused;
    }
    // Offline, busy, or the job not stored yet because the other phone has not sent it: next sync.
    log.info("job record not sent yet", { kind: r.kind, error: err instanceof Error ? err.message : String(err) });
    return Outcome.later;
  }
}

/** What one run did: facts the server took, and whether any is left to try again later. */
export interface SendResult {
  taken: number;
  later: boolean;
}

/** Sends one job's facts in order, stopping at the first to try later: what follows needs it there first. */
async function sendJob(deps: RecordsDeps, reports: RecordReport[]): Promise<SendResult> {
  let taken = 0;
  for (const r of [...reports].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))) {
    const outcome = await attempt(deps, r);
    if (outcome === Outcome.later) return { taken, later: true };
    // A job the server will never store has no status, payments or stars to follow it.
    if (outcome === Outcome.refused && r.kind === ReportKind.job) break;
    if (outcome === Outcome.taken) taken += 1;
  }
  return { taken, later: false };
}

/**
 * After a sync, or right after the owner signs, pays or rates: sends what is pending, once the owner agreed to the
 * notice. A fact that is not taken stays pending and goes again on the next sync. Never throws.
 */
export async function sendRecords(
  deps: RecordsDeps,
  jobs: readonly JobRecord[],
  payments: readonly Payment[],
): Promise<SendResult> {
  if (!(await recordsAgreed(deps.storage))) return { taken: 0, later: false };
  const pending = await pendingRecords(deps.storage, jobs, payments);
  const byJob = new Map<string, RecordReport[]>();
  for (const r of pending) byJob.set(r.engagement, [...(byJob.get(r.engagement) ?? []), r]);
  const results = await Promise.all([...byJob.values()].map((reports) => sendJob(deps, reports)));
  return { taken: results.reduce((n, r) => n + r.taken, 0), later: results.some((r) => r.later) };
}

/** After the owner's records were deleted: everything counts as unsent, for if they agree again. */
export async function forgetSentRecords(storage: Storage): Promise<void> {
  const ids = await storage.ids(Collection.recordsSent);
  await Promise.all(ids.map((id) => storage.delete(Collection.recordsSent, id)));
}
