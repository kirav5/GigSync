import { OFFERS_PER_HOUSEHOLD_DAY, OFFERS_PER_WORKER_DAY, OfferRefusal, QR_CODE_BYTES } from "@gigsync/protocol";
import type { OfferCounts } from "../db/qr-offers.js";

/** Code lookups are counted per person over this window (QR_LOOKUPS_PER_HOUR). */
export const LOOKUP_WINDOW_MS = 60 * 60_000;
/** Offers are counted over the last day. */
export const OFFER_WINDOW_MS = 24 * 60 * 60_000;
/**
 * A work_offer envelope must reach the mailbox this soon after its offer was taken: the phone sends it right after,
 * and an hour covers a retry on a bad network without letting one taken offer carry envelopes for a day.
 */
export const OFFER_SEND_MS = 60 * 60_000;

const R = OfferRefusal.enum;

/** Why an offer may not go now, or undefined when it may. Pure: the counts come from the database. */
export function offerRefusal(c: OfferCounts): OfferRefusal | undefined {
  if (c.again) return R.offered_today;
  if (c.byWorker >= OFFERS_PER_WORKER_DAY) return R.worker_limit;
  if (c.toHousehold >= OFFERS_PER_HOUSEHOLD_DAY) return R.household_limit;
  return undefined;
}

const BASE64_PLUS = /\+/g;
const BASE64_SLASH = /\//g;

/** A fresh code: QR_CODE_BYTES random bytes, base64url without padding (12 characters for 9 bytes). */
export function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(QR_CODE_BYTES));
  return btoa(String.fromCharCode(...bytes))
    .replace(BASE64_PLUS, "-")
    .replace(BASE64_SLASH, "_");
}
