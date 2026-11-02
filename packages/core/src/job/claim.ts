import { type Cancel, type DeviceId, type EngagementId, EnvelopeKind } from "@gigsync/protocol";
import { apply, TransitionError } from "../engagement/machine.js";
import { log } from "../log.js";
import type { Relay } from "../net/api.js";
import type { JobContext } from "./context.js";
import { stamped } from "./history.js";
import type { JobRecord } from "./store.js";

const K = EnvelopeKind.enum;

/**
 * Which of this owner's devices runs the agent for a new request (ADR 0045): the first to claim it in the owner's
 * mailbox. The request was just fetched from that mailbox, so a failed claim is rare; this device then answers, since
 * a request nobody answers is worse than a second quote the household's phone drops as out of turn.
 */
export async function claimFor(relay: Relay, engagement: EngagementId, me: DeviceId): Promise<DeviceId> {
  try {
    return await relay.claim(engagement);
  } catch (err) {
    log.warn("claim failed; this device answers", {
      engagement,
      error: err instanceof Error ? err.message : String(err),
    });
    return me;
  }
}

/**
 * A job another of this owner's devices negotiates: this one keeps the request to show and follows only the
 * household calling it off. Its own moves never happened here, so every other envelope would be out of turn.
 */
export async function mirror(ctx: JobContext, r: JobRecord, kind: EnvelopeKind, body: unknown): Promise<void> {
  if (kind !== K.cancel) {
    log.debug("envelope for a job another device runs", { engagement: r.engagement.id, kind });
    return;
  }
  try {
    const now = ctx.clock.now();
    const ended = stamped({ ...r, engagement: apply(r.engagement, kind, now) }, now.toISOString());
    await ctx.store.saveJob({ ...ended, cancel: body as Cancel });
  } catch (err) {
    if (!(err instanceof TransitionError)) throw err;
    log.debug("cancel out of turn on a job another device runs", { engagement: r.engagement.id });
  }
}
