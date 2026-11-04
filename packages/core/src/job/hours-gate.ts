import { HOURS_PROTOCOL, type Terms, type UserId } from "@gigsync/protocol";
import type { JobContext } from "./context.js";
import type { JobRecord } from "./store.js";

/**
 * Start hours travel only between phones that understand them (ADR 0053 §1). An older phone drops `when.hour` when it
 * reads an offer and would hash different terms when signing, so on a job with one, every time this side sends, wants
 * or compares is its part of the day alone, as before.
 */

/** Whether every phone of `user` understands start hours; false when unsure, so an older phone never stalls. */
export async function speaksHours(ctx: JobContext, user: UserId): Promise<boolean> {
  try {
    return await ctx.speaks(user, HOURS_PROTOCOL);
  } catch {
    return false;
  }
}

/** Whether this job's times carry a start hour: decided once, with whether it carries terms at all. */
export const hoursOn = (ctx: JobContext, r: JobRecord): Promise<boolean> =>
  r.terms?.hours !== undefined ? Promise.resolve(r.terms.hours) : speaksHours(ctx, r.engagement.counterpart);

/** The terms as a job may carry them: without the start hour unless both phones understand hours. */
export function withHours<T extends Terms | undefined>(terms: T, hours: boolean | undefined): T {
  if (hours || terms?.when?.hour === undefined) return terms;
  const { hour: _hour, ...when } = terms.when;
  return { ...terms, when };
}
