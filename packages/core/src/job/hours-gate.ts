import { HOURS_PROTOCOL, Role, type Terms, type UserId } from "@gigsync/protocol";
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

/**
 * Whether this job's times carry a start hour; one answer for both phones. The household decides when it sends the
 * request, from whether every phone of the worker understands hours. The worker follows: hours are on once the
 * household has sent one, never from a check of its own, so the two phones cannot disagree. A job from before hours
 * stays without them.
 */
export async function hoursOn(ctx: JobContext, r: JobRecord, theirs?: Terms): Promise<boolean> {
  if (r.engagement.role === Role.enum.provider)
    return r.terms?.hours === true || r.request.terms?.when?.hour !== undefined || theirs?.when?.hour !== undefined;
  if (r.terms?.hours !== undefined) return r.terms.hours;
  return r.terms ? false : speaksHours(ctx, r.engagement.counterpart);
}

/** The terms as a job may carry them: without the start hour unless both phones understand hours. */
export function withHours<T extends Terms | undefined>(terms: T, hours: boolean | undefined): T {
  if (hours || terms?.when?.hour === undefined) return terms;
  const { hour: _hour, ...when } = terms.when;
  return { ...terms, when };
}
