import { QuestionKey, RateCard, ScopeKind, Trade } from "@gigsync/protocol";

/**
 * The city pack's going rates that ship with the pilot app, until the union signs its own card (ADR 0016 §2). Monthly
 * rates for live-out household work in Bengaluru. These are seed values written by the team, to be replaced by the
 * union's numbers before the pilot. Trades without a band keep pricing from the worker's own rates.
 */
const Q = QuestionKey.enum;
const FLAG = ScopeKind.enum.flag;
const COUNT = ScopeKind.enum.count;

export const CITY_RATES: RateCard = RateCard.parse({
  city: "Bengaluru",
  version: 1,
  bands: [
    {
      trade: Trade.enum.cook,
      low_paise: 750000,
      high_paise: 950000,
      scope: [
        { kind: FLAG, key: Q.pets, percent: 15 },
        { kind: COUNT, key: Q.people, percent: 10, included: 3 },
      ],
    },
    {
      trade: Trade.enum.maid,
      low_paise: 500000,
      high_paise: 700000,
      scope: [
        { kind: FLAG, key: Q.pets, percent: 10 },
        { kind: COUNT, key: Q.rooms, percent: 10, included: 2 },
      ],
    },
  ],
});
