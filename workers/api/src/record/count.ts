import { log } from "@gigsync/core/log";
import type { EnvelopeHeader } from "@gigsync/protocol";
import type { Db } from "../db/client.js";
import { COUNTED_KINDS, countDelivery } from "../db/records.js";

/**
 * Counts a delivered envelope toward the recipient's record (ADR 0036), from its headers only. Runs for duplicates
 * too, which repairs a count that failed the first time (counting is idempotent); never for an envelope already expired,
 * which the mailbox does not store, nor between a user and themselves. Never fails the delivery: a failed count is
 * logged and the envelope still goes through.
 */
export async function countForRecord(db: Db, h: EnvelopeHeader, requestId: string): Promise<void> {
  if (!COUNTED_KINDS.has(h.kind) || h.from.user === h.to.user || Date.parse(h.expires_at) <= Date.now()) return;
  try {
    await countDelivery(db, h);
  } catch (err) {
    const { name, message } = err instanceof Error ? err : new Error(String(err));
    log.warn("record count failed", { requestId, kind: h.kind, error: name, message });
  }
}
