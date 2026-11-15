import { DEFAULT_ARRANGEMENT, PAISE_PER_RUPEE } from "@gigsync/protocol";
import type { MessageKey } from "../i18n/t.js";
import { advance, type InterviewState, retry, Slot } from "./card.js";
import { mainOf } from "./card-arrangements.js";
import { cardEstimate } from "./card-estimate.js";

/**
 * An amount answered to the usual-rate or lowest question, said, typed or set on the price card: checked against the
 * usual range, asked back ("Did you mean ₹…?") when far outside it, and kept with its readback.
 */

/** An amount this far outside the city's usual range for the trade is checked before it is kept. */
const BAND_SPREAD = 4;
const NO_BAND_LOW = 50 * PAISE_PER_RUPEE;
const NO_BAND_HIGH = 50_000 * PAISE_PER_RUPEE;
export const Say = {
  againAmount: "iv.again.amount",
  againYesNo: "iv.again.yes_no",
} as const satisfies Record<string, MessageKey>;

/**
 * Whether an amount sits within the usual range for the worker's first trade (the estimate's, else the city band's),
 * or a wide one when there is neither.
 */
function plausible(s: InterviewState, paise: number): boolean {
  // The city band is monthly: a rate for an hour, a visit or a week is checked against its estimate alone.
  const monthly = (mainOf(s.draft) ?? DEFAULT_ARRANGEMENT) === DEFAULT_ARRANGEMENT;
  const cityBand = monthly ? s.config.rates.bands.find((b) => b.trade === s.draft.trades?.[0]) : undefined;
  const band = cardEstimate(s)?.estimate ?? cityBand;
  const low = band ? band.low_paise / BAND_SPREAD : NO_BAND_LOW;
  const high = band ? band.high_paise * BAND_SPREAD : NO_BAND_HIGH;
  return paise >= low && paise <= high;
}

/**
 * Whether a line carrying the lowest rate may be read aloud: only when the owner said the amount aloud, so everyone
 * in earshot heard it already. Typed, it was meant to stay private, and it is shown but never spoken.
 */
export const minAloud = (aloud: boolean): { silent?: true } => (aloud ? {} : { silent: true });

function keepAmount(s: InterviewState, paise: number, aloud: boolean): InterviewState {
  if (s.slot === Slot.rate)
    return advance(s, { ...s.draft, rate_paise: paise }, [{ key: "iv.got_rate", prices: { price: paise } }]);
  const readback = { key: "iv.got_min", prices: { price: paise }, ...minAloud(aloud) } as const;
  return advance(s, { ...s.draft, limit_paise: paise }, [readback]);
}

export function onAmount(s: InterviewState, paise: number | undefined, aloud: boolean): InterviewState {
  const cleared = { ...s, pending: undefined, pendingAloud: undefined };
  if (paise === undefined || paise <= 0) return retry(cleared, { key: Say.againAmount });
  const rate = s.draft.rate_paise;
  if (s.slot === Slot.min && rate !== undefined && paise > rate)
    return retry(cleared, { key: "iv.err_min", prices: { price: rate } });
  if (!plausible(s, paise)) return { ...cleared, pending: paise, pendingAloud: aloud, notes: [], fresh: false };
  return keepAmount(cleared, paise, aloud);
}

/**
 * The answer to "Did you mean ₹…?": yes or the same amount keeps it; another amount is checked afresh. A yes keeps the
 * amount as it was given: typed stays quiet even when the yes is spoken.
 */
export function onCheck(
  s: InterviewState,
  yes: boolean | undefined,
  paise: number | undefined,
  aloud: boolean,
): InterviewState {
  const pending = s.pending ?? 0;
  const cleared = { ...s, pending: undefined, pendingAloud: undefined };
  if (yes === true || paise === pending)
    return keepAmount(cleared, pending, s.pendingAloud === true || (paise === pending && aloud));
  if (paise !== undefined) return onAmount(s, paise, aloud);
  if (yes === false) return retry(cleared, { key: Say.againAmount });
  return retry(s, { key: Say.againYesNo });
}
