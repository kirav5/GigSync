import { QuestionKey, RateCard, ScopeKind, SEED_SIGNER, Trade } from "@gigsync/protocol";

/**
 * The city pack's going rates that ship with the pilot app, until the union signs its own card (ADR 0016 §2). Monthly
 * rates for live-out household work in Bengaluru, researched 2026-10-28. Every number below names its source; none
 * comes from a survey newer than 2022, so the card is marked as a seed and the app says so (`signed_by`). Every low
 * sits above the statutory floor (`LEGAL_MINIMUM` below).
 */
const Q = QuestionKey.enum;
const FLAG = ScopeKind.enum.flag;
const COUNT = ScopeKind.enum.count;

export const CITY_RATES: RateCard = RateCard.parse({
  city: "Bengaluru",
  version: 2,
  signed_by: SEED_SIGNER,
  bands: [
    {
      // Two meals, up to three people. Low: Cookzy Bengaluru FAQ and Solve24's all-India veg floor (₹7,000). High:
      // Cookzy (₹12,000), under Solve24's Bengaluru ceiling of ₹12,500 for 3–4 people (solve24.in, 2026).
      trade: Trade.enum.cook,
      low_paise: 700000,
      high_paise: 1200000,
      scope: [
        // Solve24: ₹500–1,000 a month for each extra person, about 8% of the band's middle.
        { kind: COUNT, key: Q.people, percent: 8, included: 3 },
        // BookMyBai (2025): ₹500 a month as an example for pet care, not Bengaluru-specific; about 5%.
        { kind: FLAG, key: Q.pets, percent: 5 },
      ],
    },
    {
      // 2BHK, sweeping, mopping and dishes, 1.5–2 hours a day. Low: the statutory pro-rata above, inside Knoqq's
      // ₹3,000–4,500 (knoqq.com, Apr 2026). High: EzyHelpers' single-task ceiling (Jul 2026), inside MyBuddyMaid's
      // ₹4,500–9,000 (Sep 2026). The sources differ about twofold, so this band is the weaker one.
      trade: Trade.enum.maid,
      low_paise: 350000,
      high_paise: 800000,
      scope: [
        // No source prices rooms; Knoqq says a third bedroom adds 30–45 minutes to about two hours, so ~15% a room.
        { kind: COUNT, key: Q.rooms, percent: 15, included: 2 },
        { kind: FLAG, key: Q.pets, percent: 5 },
      ],
    },
  ],
});

/** One trade's statutory floor: the notified rate for a full day, and the part-time hours the band's low is for. */
export interface DayRate {
  day_paise: number;
  hours: number;
}

/** A state's minimum wage for the rate card's trades, pro-rated by hours since the law names no part-time rate. */
export interface LegalMinimum {
  /** The rate card city it holds in; another city's card shows no minimum rather than the wrong state's. */
  city: string;
  /** Hours in the notified day. */
  day_hours: number;
  /** Working days a month, the usual conversion of a day rate to a monthly wage. */
  days_per_month: number;
  trades: Readonly<Partial<Record<Trade, DayRate>>>;
}

/**
 * Statutory floor (Karnataka, "Residential houses incl. domestic helpers", Zone I, 1 Apr 2026 – 31 Mar 2027,
 * notification KAE 68 LWA 2022 with VDA; karmikaspandana.karnataka.gov.in): cooking ₹790.32/day, housekeeping and
 * dishes ₹717.12/day, for an 8-hour day. There is no part-time rate; pro-rated to 2.5 hours a day for a cook and
 * 1.5 hours for a maid, at 26 working days, that is ₹6,421.35 and ₹3,495.96 a month. A 22 May 2026 revision (KA 411
 * LWA 2023) is before the High Court and may raise them: check before the pilot.
 */
export const LEGAL_MINIMUM: LegalMinimum = {
  city: CITY_RATES.city,
  day_hours: 8,
  days_per_month: 26,
  trades: {
    [Trade.enum.cook]: { day_paise: 79032, hours: 2.5 },
    [Trade.enum.maid]: { day_paise: 71712, hours: 1.5 },
  },
};
