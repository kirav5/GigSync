import {
  City,
  type Estimate,
  type EstimateRequest,
  type EstimateResponse,
  type EstimateSource,
  type Place,
  RateUnit,
  type SharedPrice,
} from "@gigsync/protocol";
import type { EstimateApi, EstimateOptions } from "../src/index.js";

/** Estimates as the server's fixture source answers them (workers/api, ESTIMATE_SOURCE=fixture). */

const AS_OF = "2026-11-02T09:00:00.000Z";
const source = (n: number, unit: RateUnit = RateUnit.enum.job): EstimateSource => ({
  url: `https://site${n % 3}.example/page${n}`,
  site: `site${n % 3}.example`,
  sentence: `Painting a 2BHK costs Rs ${14 + n},000.`,
  amount_paise: (14_000 + n * 1000) * 100,
  unit,
});

/** A 2BHK painted, labour only: ₹14,000 / ₹16,000 / ₹18,000 for the job, from five pages on three sites. */
export const PAINT_2BHK: Estimate = {
  low_paise: 1_400_000,
  typical_paise: 1_600_000,
  high_paise: 1_800_000,
  unit: RateUnit.enum.job,
  basis: { sources: [0, 1, 2, 3, 4].map((n) => source(n)), gigsync_jobs: 0, floored: false },
  as_of: AS_OF,
};

/** A cook for 3–4 people, two meals: ₹10,000 / ₹11,000 / ₹12,000 a month, floored at ₹6,430. */
export const COOK_MONTH: Estimate = {
  low_paise: 1_000_000,
  typical_paise: 1_100_000,
  high_paise: 1_200_000,
  unit: RateUnit.enum.month,
  basis: { sources: [0, 1, 2].map((n) => source(n)), gigsync_jobs: 12, legal_minimum_paise: 643_000, floored: false },
  as_of: AS_OF,
};

/** Painting by the square foot: ₹12 / ₹15 / ₹18 a square foot painted. */
export const PAINT_SQFT: Estimate = {
  ...PAINT_2BHK,
  low_paise: 1_200,
  typical_paise: 1_500,
  high_paise: 1_800,
  unit: RateUnit.enum.sqft,
};

/** The server's estimate routes in memory: answers from `answers` by trade, records every call. */
export class FakeEstimateApi implements EstimateApi {
  readonly asked: EstimateRequest[] = [];
  readonly shared: SharedPrice[] = [];
  failShares = false;

  constructor(private readonly answers: (request: EstimateRequest) => EstimateResponse | Error) {}

  async estimate(request: EstimateRequest): Promise<EstimateResponse> {
    this.asked.push(request);
    const answer = this.answers(request);
    if (answer instanceof Error) throw answer;
    return answer;
  }

  async sharePrice(price: SharedPrice): Promise<void> {
    if (this.failShares) throw new Error("offline");
    this.shared.push(price);
  }
}

/** Points that are pilot area centres, by slug. */
export const AREA_KEYS: readonly { key: string; place: Place }[] = [
  { key: "hsr-layout", place: { lat: 12.975, lon: 77.645 } },
];

export const estimateOptions = (api: EstimateApi): EstimateOptions => ({
  api,
  city: City.enum.bengaluru,
  areaKey: (p) => AREA_KEYS.find((a) => a.place.lat === p.lat && a.place.lon === p.lon)?.key,
});
