import {
  DEFAULT_LANG,
  type EngagementStatus,
  type ExportedJob,
  JobRecordStatus,
  type Payment,
  PaymentStatus,
  type Place,
  Role,
  EngagementStatus as Status,
  type UserId,
} from "@gigsync/protocol";
import type { JobRecord, JobStore } from "../job/store.js";
import { WhenDetail } from "../job/when.js";
import { log } from "../log.js";
import { allMyRecords } from "./export.js";
import type { RecordsApi } from "./types.js";

/**
 * A new phone's jobs, refilled from the owner's record on GigSync (ADR 0038 §4 and its consequence "job history
 * restores from the server"): the structured facts only. The words, the agents' messages and the contacts never went
 * to the server, so a restored job has none; it is shown, counted and paid up as it was, but nothing is sent on it.
 */

/** What a restored job keeps beyond what its engagement and request already say. */
export interface RestoredFacts {
  /** Both sides' accounts matched on the server, or only the worker's reached it. */
  attested: boolean;
  agreed_at: string;
  price_paise: number;
  work: ExportedJob["work"];
  /** The job's payments as this owner's own, rebuilt from the record: they are never in the payment book. */
  payments: Payment[];
}

/** Who the other side was once they deleted their records: the record keeps the job without them. */
export const GONE_COUNTERPART: UserId = "usr_00000000000000000000000000";
/** A restored request has no area: the record never held one. */
const NO_AREA: Place = { lat: 0, lon: 0 };
/** A day's payment filed at its midday, so no time zone moves it to another date. */
const NOON_UTC = "T12:00:00Z";

const STATUS: Readonly<Record<JobRecordStatus, EngagementStatus>> = {
  [JobRecordStatus.enum.agreed]: Status.enum.agreed,
  [JobRecordStatus.enum.done]: Status.enum.closed,
  [JobRecordStatus.enum.cancelled]: Status.enum.cancelled,
};

/** The record's payments as this phone keeps payments: confirmed by the worker, or the household's word alone. */
function paymentsOf(job: ExportedJob, me: UserId, them: UserId): Payment[] {
  const worker = job.role === Role.enum.provider ? me : them;
  const household = job.role === Role.enum.provider ? them : me;
  return job.payments.map((p) => {
    const at = `${p.paid_on}${NOON_UTC}`;
    return {
      id: p.payment,
      engagement: job.engagement,
      payee: worker,
      payer: household,
      amount_paise: p.amount_paise,
      method: p.method,
      status: p.confirmed ? PaymentStatus.enum.confirmed : PaymentStatus.enum.paid,
      note: "",
      requested_at: at,
      paid_at: at,
      ...(p.confirmed ? { confirmed_at: at } : {}),
    };
  });
}

/** One job from the record as this phone keeps jobs: no words, no offers, no signatures, no contact. */
export function restoredJob(job: ExportedJob, me: UserId): JobRecord {
  const them = job.counterpart ?? GONE_COUNTERPART;
  const day = job.terms.when?.day;
  return {
    engagement: {
      id: job.engagement,
      group: job.engagement,
      role: job.role,
      counterpart: them,
      status: STATUS[job.status],
      brief: { text: "", topic: job.work.trade, shared: {} },
      created_at: job.agreed_at,
      updated_at: job.done_at ?? job.cancelled_at ?? job.agreed_at,
    },
    request: {
      trade: job.work.trade,
      need: "",
      when: "",
      area: NO_AREA,
      details: day ? { [WhenDetail.day]: day } : {},
      lang: DEFAULT_LANG,
      terms: job.terms,
    },
    offers: [],
    offers_made: 0,
    asked: false,
    ...(job.stars ? { review: { stars: job.stars, text: "" } } : {}),
    restored: {
      attested: job.attested,
      agreed_at: job.agreed_at,
      price_paise: job.price_paise,
      work: job.work,
      payments: paymentsOf(job, me, them),
    },
  };
}

/** The payments of every restored job, to show beside the payment book's own. */
export const restoredPayments = (jobs: readonly JobRecord[]): Payment[] =>
  jobs.flatMap((j) => j.restored?.payments ?? []);

/**
 * On a phone with no jobs for this owner, every job of their record, added as restored. A job already here (the move
 * from the old phone may have brought it) is never overwritten. Returns how many were added.
 */
export async function restoreFromRecord(
  api: Pick<RecordsApi, "myJobRecords">,
  store: JobStore,
  me: UserId,
): Promise<number> {
  if ((await store.jobs()).length > 0) return 0;
  let added = 0;
  // One after another on purpose: each checks the store, which the move may be filling meanwhile.
  for (const job of await allMyRecords(api)) {
    if (await store.job(job.engagement)) continue;
    await store.saveJob(restoredJob(job, me));
    added += 1;
  }
  if (added > 0) log.info("jobs restored from the record", { jobs: added });
  return added;
}
