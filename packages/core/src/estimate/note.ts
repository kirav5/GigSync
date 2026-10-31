import { type Estimate, Role } from "@gigsync/protocol";

/**
 * A note beside an offer far outside the estimate for the job, to the owner it matters to: a worker sees when an
 * offer is well below the usual rate, a household when one is well above it. A note only, never a block (ADR 0030 §5):
 * the agents negotiate exactly as they would without it.
 */

/** Below this share of the estimate's low figure, an offer is well below the usual rate. */
export const FAR_BELOW_SHARE = 0.8;
/** Above this multiple of the estimate's high figure, an offer is well above the usual rate. */
export const FAR_ABOVE_SHARE = 1.2;

export const OfferNote = { below: "below", above: "above" } as const;
export type OfferNote = (typeof OfferNote)[keyof typeof OfferNote];

/** The note for an offer of `price_paise`, as the owner on `role`'s side sees it; none when the price is usual. */
export function offerNote(
  estimate: Pick<Estimate, "low_paise" | "high_paise">,
  role: Role,
  price_paise: number,
): OfferNote | undefined {
  if (role === Role.enum.provider)
    return price_paise < estimate.low_paise * FAR_BELOW_SHARE ? OfferNote.below : undefined;
  return price_paise > estimate.high_paise * FAR_ABOVE_SHARE ? OfferNote.above : undefined;
}
