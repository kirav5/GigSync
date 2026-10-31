import type { PaiseRange } from "@gigsync/core";
import {
  type AreaKey,
  type Confidence,
  type DriverName,
  ESTIMATE_MAX_PAISE,
  type Estimate,
  EstimateBasisKind,
  type PriceUnit,
  type RateCardSource,
} from "@gigsync/protocol";
import { ROUND_PAISE } from "./constants.js";
import { roundTo } from "./round.js";

/** How the basis names a city's card; the phone words it in its owner's language. */
const RATE_CARD_NAME = "rate card";
const dedupe = (sources: readonly RateCardSource[]) =>
  sources.filter((s, i) => sources.findIndex((o) => o.name === s.name) === i);

/** One source of a range: its band for the whole job and how much it weighs. */
export interface Part {
  kind: EstimateBasisKind;
  band: PaiseRange;
  weight: number;
}

export interface Blended {
  band: PaiseRange;
  /** The sources blended, heaviest first. */
  kinds: EstimateBasisKind[];
}

/** The weighted mean of each figure; undefined with no source. */
export function blendParts(parts: readonly Part[]): Blended | undefined {
  const total = parts.reduce((sum, p) => sum + p.weight, 0);
  if (parts.length === 0 || total <= 0) return undefined;
  const mean = (pick: (b: PaiseRange) => number) => parts.reduce((s, p) => s + pick(p.band) * p.weight, 0) / total;
  const kinds = [...parts].sort((a, b) => b.weight - a.weight).map((p) => p.kind);
  return { band: { low: mean((b) => b.low), typical: mean((b) => b.typical), high: mean((b) => b.high) }, kinds };
}

export interface DriverEstimateInput {
  band: PaiseRange;
  kinds: readonly EstimateBasisKind[];
  unit: PriceUnit;
  floor?: number | undefined;
  jobs: number;
  area?: AreaKey;
  /** The rate card's figures' provenance, when the card is in the blend. */
  card?: { sources: readonly RateCardSource[] };
  confidence: Confidence;
  assumed: readonly DriverName[];
  now: Date;
}

/** The estimate a phone sees: rounded to ₹10, raised to the legal floor (saying so), with its basis and label. */
export function driverEstimate(i: DriverEstimateInput): Estimate {
  let floored = false;
  const figure = (value: number) => {
    const rounded = Math.min(roundTo(value, ROUND_PAISE), ESTIMATE_MAX_PAISE);
    if (i.floor === undefined || rounded >= i.floor) return rounded;
    floored = true;
    return i.floor;
  };
  const low = figure(i.band.low);
  const typical = Math.max(low, figure(i.band.typical));
  const high = Math.max(typical, figure(i.band.high));
  const [kind = EstimateBasisKind.enum.rate_card] = i.kinds;
  return {
    low_paise: low,
    typical_paise: typical,
    high_paise: high,
    unit: i.unit,
    basis: {
      kind,
      sources: [],
      gigsync_jobs: i.kinds.includes(EstimateBasisKind.enum.gigsync) ? i.jobs : 0,
      ...(i.area ? { area: i.area } : {}),
      ...(i.floor === undefined ? {} : { legal_minimum_paise: i.floor }),
      floored,
      blend: [...i.kinds],
      ...(i.card ? { rate_card: { name: RATE_CARD_NAME, sources: dedupe(i.card.sources) } } : {}),
    },
    as_of: i.now.toISOString(),
    confidence: i.confidence,
    ...(i.assumed.length > 0 ? { assumed: [...i.assumed] } : {}),
    ...(i.assumed[0] ? { spread_by: i.assumed[0] } : {}),
  };
}
