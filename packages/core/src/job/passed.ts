import { EngagementStatus, Role, type TermWhen } from "@gigsync/protocol";
import { whenPassed } from "../schedule/windows.js";
import type { JobContext } from "./context.js";
import { askTime, clearTalkTasks } from "./handover.js";
import { type JobRecord, TaskKind } from "./store.js";
import { theirLast } from "./talks.js";

/**
 * A job whose time passes while nobody sends anything (ADR 0053 §2): the household's agent cannot sign it and the
 * owner must not, so on each sync a household's job whose turn is its own, and whose time is over, goes to the owner
 * to pick a new time or end it. A decision about the talk or a deal waiting for their signature gives way to it.
 */

const S = EngagementStatus.enum;
/** Talks still open on the household's side. */
const OPEN: ReadonlySet<EngagementStatus> = new Set([S.sent, S.clarifying, S.responded, S.negotiating]);

/** The time this job would be signed at now: a deal waiting to be signed, the worker's last offer, else the asked. */
const timeOf = (r: JobRecord): TermWhen | undefined =>
  r.pending?.terms?.when ?? theirLast(r)?.terms?.when ?? r.time ?? r.request.terms?.when;

/** Asks the household's owner for a new time on each of its jobs whose time has passed on its turn; how many. */
export async function askWherePassed(ctx: JobContext): Promise<number> {
  const now = ctx.clock.now();
  let asked = 0;
  for (const r of await ctx.store.jobs()) {
    if (r.engagement.role !== Role.enum.requester || r.elsewhere || r.mine || !OPEN.has(r.engagement.status)) continue;
    const when = timeOf(r);
    if (!theirLast(r) || !when || !whenPassed(when, now)) continue;
    if (await ctx.store.task(TaskKind.newTime, r.engagement.id)) continue;
    await clearTalkTasks(ctx, r);
    await ctx.store.removeTask(TaskKind.confirmDeal, r.engagement.id);
    await askTime(ctx, { ...r, pending: undefined }, { passed: true });
    asked++;
  }
  return asked;
}
