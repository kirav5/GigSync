import type { EngagementId, ExportedJob, ExportedPayment, MyJobRecords, UserId } from "@gigsync/protocol";
import type { RecordRowOut } from "../db/job-records.js";
import { quantitiesOf } from "../db/record-quantities.js";
import { termsOf, workOf } from "./fields.js";
import { roleOf, Side } from "./sides.js";

function quantitiesField(r: RecordRowOut) {
  const quantities = quantitiesOf(r);
  return quantities ? { quantities } : {};
}

/** One stored job from the caller's side: their role, the other party (null once they deleted theirs), the rest as kept. */
function exportedJob(r: RecordRowOut, user: UserId, payments: ExportedPayment[], hours: boolean): ExportedJob {
  const mine = r.worker_id === user ? Side.worker : Side.household;
  return {
    engagement: r.engagement_id,
    role: roleOf(mine),
    counterpart: mine === Side.worker ? r.household_id : r.worker_id,
    work: workOf(r),
    ...quantitiesField(r),
    terms: termsOf(r, hours),
    price_paise: r.price_paise,
    status: r.status,
    attested: r.attested,
    agreed_at: r.agreed_at.toISOString(),
    ...(r.done_at && { done_at: r.done_at.toISOString() }),
    ...(r.cancelled_at && { cancelled_at: r.cancelled_at.toISOString() }),
    ...(r.stars !== null && { stars: r.stars }),
    payments,
  };
}

/**
 * A page of the export from up to `limit + 1` rows: the extra row only says there is a next page. `hours`: the caller's
 * device reads start hours; an older one gets each time without its hour.
 */
export function exportPage(
  rows: RecordRowOut[],
  limit: number,
  user: UserId,
  payments: Map<EngagementId, ExportedPayment[]>,
  hours = true,
): MyJobRecords {
  const page = rows.slice(0, limit);
  const jobs = page.map((r) => exportedJob(r, user, payments.get(r.engagement_id) ?? [], hours));
  const last = page.at(-1);
  return rows.length > limit && last ? { jobs, next: last.engagement_id } : { jobs };
}
