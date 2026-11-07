import { City, type Estimate, type EstimateRequest, type EstimateResponse, RateUnit } from "@gigsync/protocol";
import { type EstimateApi, type EstimateOptions, GIGSYNC_SEED, KARNATAKA_MINIMUM } from "../src/index.js";

/** Estimates as the server answers them from the city's rate card (ADR 0041), with no GigSync jobs to go on. */

const AS_OF = "2026-11-02T09:00:00.000Z";
const RATE_CARD = "rate card";

/** A 2BHK painted, labour only: ₹14,000 / ₹16,000 / ₹18,000 for the job, from the rate card's seed figures. */
export const PAINT_2BHK: Estimate = {
  low_paise: 1_400_000,
  typical_paise: 1_600_000,
  high_paise: 1_800_000,
  unit: RateUnit.enum.job,
  basis: {
    kind: "rate_card",
    sources: [],
    gigsync_jobs: 0,
    floored: false,
    blend: ["rate_card"],
    rate_card: { name: RATE_CARD, sources: [GIGSYNC_SEED] },
  },
  as_of: AS_OF,
};

/** A cook for 3–4 people, two meals: ₹10,000 / ₹11,000 / ₹12,000 a month, floored at ₹6,430. */
export const COOK_MONTH: Estimate = {
  low_paise: 1_000_000,
  typical_paise: 1_100_000,
  high_paise: 1_200_000,
  unit: RateUnit.enum.month,
  basis: {
    kind: "rate_card",
    sources: [],
    gigsync_jobs: 0,
    legal_minimum_paise: 643_000,
    floored: false,
    blend: ["rate_card"],
    rate_card: { name: RATE_CARD, sources: [KARNATAKA_MINIMUM] },
  },
  as_of: AS_OF,
};

/** The same cook job from 34 jobs agreed on GigSync in Jayanagar (ADR 0039): ₹10,500 / ₹11,000 / ₹12,500 a month. */
export const COOK_GIGSYNC: Estimate = {
  low_paise: 1_050_000,
  typical_paise: 1_100_000,
  high_paise: 1_250_000,
  unit: RateUnit.enum.month,
  basis: {
    kind: "gigsync",
    sources: [],
    gigsync_jobs: 34,
    area: "jayanagar",
    legal_minimum_paise: 643_000,
    floored: false,
  },
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

/** The server's estimate route in memory: answers from `answers` by trade, records every call. */
export class FakeEstimateApi implements EstimateApi {
  readonly asked: EstimateRequest[] = [];

  constructor(private readonly answers: (request: EstimateRequest) => EstimateResponse | Error) {}

  async estimate(request: EstimateRequest): Promise<EstimateResponse> {
    this.asked.push(request);
    const answer = this.answers(request);
    if (answer instanceof Error) throw answer;
    return answer;
  }
}

export const estimateOptions = (api: EstimateApi): EstimateOptions => ({ api, cityOf: () => City.enum.bengaluru });
