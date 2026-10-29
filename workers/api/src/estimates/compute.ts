import {
  type EstimateRequest,
  type EstimateSource,
  MAX_ESTIMATE_SOURCES,
  NoEstimateReason,
  PAISE_PER_RUPEE,
} from "@gigsync/protocol";
import { MIN_QUOTES, MIN_SITES } from "./constants.js";
import { inRequestUnit } from "./normalise.js";
import { type Band, bandOf, withoutOutliers } from "./stats.js";
import { type CheckedQuote, checkQuotes, DropReason, type SourcedQuotes } from "./verify.js";

/** What the web says a job costs: unrounded percentiles in paise, how many quotes they rest on, and those quotes. */
export interface WebBand {
  band: Band;
  count: number;
  sources: EstimateSource[];
}

/** The web band, or why there is none, plus every reason a quote was dropped (for the log and tests). */
interface WebOutcome {
  result: WebBand | NoEstimateReason;
  dropped: DropReason[];
}

interface Priced {
  quote: CheckedQuote;
  paise: number;
}

const toPaise = (rupees: number) => Math.round(rupees * PAISE_PER_RUPEE);

const asSource = (q: CheckedQuote): EstimateSource => ({
  url: q.url,
  site: q.site,
  sentence: q.sentence,
  amount_paise: toPaise(q.amount_rupees),
  unit: q.unit,
});

/** At most `max` items, evenly spaced across the sorted list, so a long list of sources still shows its whole range. */
function spread<T>(sorted: readonly T[], max: number): T[] {
  if (sorted.length <= max) return [...sorted];
  const last = sorted.length - 1;
  return Array.from({ length: max }, (_, i) => sorted[Math.round((i * last) / (max - 1))] as T);
}

/**
 * A model reads; code computes (ADR 0030 §2). From the source's pages and quotes: drop what fails the checks, convert
 * the rest to the request's unit and scope, drop outliers beyond 1.5 × IQR, then require `MIN_QUOTES` from `MIN_SITES`
 * sites. Low, typical and high are the 25th, 50th and 75th percentiles of what is left.
 */
export function webBand(req: EstimateRequest, sourced: SourcedQuotes): WebOutcome {
  const { kept, dropped } = checkQuotes(sourced);
  const priced: Priced[] = [];
  for (const quote of kept) {
    const amount = inRequestUnit(quote, req);
    if (typeof amount === "string") dropped.push(amount);
    else priced.push({ quote, paise: toPaise(amount) });
  }
  const inside = withoutOutliers(priced, (p) => p.paise);
  for (let i = inside.length; i < priced.length; i++) dropped.push(DropReason.outlier);
  const sites = new Set(inside.map((p) => p.quote.site));
  const band = bandOf(inside.map((p) => p.paise));
  if (!band || inside.length < MIN_QUOTES || sites.size < MIN_SITES) {
    return { result: NoEstimateReason.enum.too_few_quotes, dropped };
  }
  const sources = spread(inside, MAX_ESTIMATE_SOURCES).map((p) => asSource(p.quote));
  return { result: { band, count: inside.length, sources }, dropped };
}
