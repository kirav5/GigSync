import type { DriverName, DriverValues, Trade } from "@gigsync/protocol";
import { detailKeyOf, detailsToDrivers } from "../estimate/driver-details.js";
import { driverSpread } from "../estimate/driver-price.js";
import { QUESTIONS } from "../job/ask.js";
import { driversIn } from "./driver-parse.js";
import type { NeedDraft } from "./need.js";
import { MAX_PRICE_QUESTIONS, type PriceQuestion } from "./price-model.js";
import { SCOPE_READ } from "./scope-read.js";

/**
 * Which price question the need interview asks next (ADR 0041 §2, ADR 0058). For a trade, code asks the fixed drivers
 * that widen the range most, while they are worth asking, at most `MAX_PRICE_QUESTIONS`. For work outside the trades, one
 * model call writes the questions (`price-model.ts`). "I don't know" or skip ends the questions: what is still unknown
 * is assumed and shown so.
 */

/** An unknown driver is worth a fixed question when knowing it would narrow the range by at least this factor. */
export const WORTH_ASKING = 1.2;
/** Past the first two fixed questions, only while the widest unknown still spreads the range this much. */
export const WORTH_MORE = 1.4;
const USUAL_QUESTIONS = 2;

/** The drivers the draft knows: from its details (what the owner said, the first question's answer) and its answers. */
export function draftDrivers(d: NeedDraft): DriverValues {
  const trade = d.trade;
  if (!trade) return {};
  const first = QUESTIONS[trade][0];
  const details = { ...d.seen, ...(first && typeof d.detail === "string" ? { [first]: d.detail } : {}) };
  return { ...detailsToDrivers(trade, details), ...d.drivers };
}

/** The trade's first question asked this already: an answer that gave no value is still never asked for twice. */
const askedFirst = (d: NeedDraft, name: DriverName): boolean =>
  d.trade !== undefined && d.detail !== undefined && QUESTIONS[d.trade][0] === detailKeyOf(name);

/** The fixed driver to ask now, widest first; undefined when none is worth it or the limit is reached. */
export function driverToAsk(d: NeedDraft): DriverName | undefined {
  const trade: Trade | undefined = d.trade;
  const asked = d.askedDrivers ?? 0;
  if (!trade || d.priceDone || asked >= MAX_PRICE_QUESTIONS) return undefined;
  const spread = driverSpread(trade, draftDrivers(d), d.arrangement);
  const next = spread.assumed.find((name) => !(d.notKnown ?? []).includes(name) && !askedFirst(d, name));
  const width = next ? (spread.widths[next] ?? 1) : 1;
  const enough = asked < USUAL_QUESTIONS ? WORTH_ASKING : WORTH_MORE;
  return next && width >= enough ? next : undefined;
}

/** The model writes this job's price questions: work outside the trades, on a phone with a model. */
export const modelLed = (d: NeedDraft): boolean => d.modelAsk !== undefined && !d.trade;

/** The question waiting for an answer: the model's, or for a trade the fixed driver's. */
export function currentQuestion(d: NeedDraft): PriceQuestion | undefined {
  if (modelLed(d)) return d.modelAsk?.current;
  const name = driverToAsk(d);
  return name ? { fills: { driver: name } } : undefined;
}

/** Price questions are still open: the model's until it is done, or a fixed one worth asking. */
export function priceOpen(d: NeedDraft): boolean {
  if (d.priceDone || (!d.trade && !d.jobType)) return false;
  return modelLed(d) || driverToAsk(d) !== undefined;
}

/** The phone's model is to be asked for the next step now (the app calls `modelPriceStep`, then `withPriceStep`). */
export const awaitingModel = (d: NeedDraft): boolean => priceOpen(d) && modelLed(d) && !d.modelAsk?.current;

/**
 * The draft with the drivers the owner's words give, where none is set yet; except those the scope chips read for the
 * trade, which wait for the owner to confirm them as chips (a chip removed must not come back as a driver).
 */
export function withWordDrivers(d: NeedDraft, words: string): NeedDraft {
  if (!d.trade || !words) return d;
  const chipped: readonly string[] = d.scope ? SCOPE_READ[d.trade] : [];
  const read = Object.entries(driversIn(words, d.trade)).filter(
    ([name]) => !chipped.includes(detailKeyOf(name as DriverName)),
  );
  return read.length === 0 ? d : { ...d, drivers: { ...Object.fromEntries(read), ...d.drivers } };
}
