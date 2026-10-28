import { QuestionKey, RateCard, ScopeKind, SEED_SIGNER, Trade } from "@gigsync/protocol";

/**
 * The city pack's going rates that ship with the pilot app, until the union signs its own card (ADR 0016 §2). Monthly
 * rates for live-out household work in Bengaluru, researched 2026-10-28. Every number below names its source; none
 * comes from a survey newer than 2022, so the card is marked as a seed and the app says so (`signed_by`).
 *
 * Statutory floor (Karnataka, "Residential houses incl. domestic helpers", Zone I, 1 Apr 2026 – 31 Mar 2027,
 * notification KAE 68 LWA 2022 with VDA; karmikaspandana.karnataka.gov.in): cooking ₹790.32/day, housekeeping and
 * dishes ₹717.12/day, for an 8-hour day. There is no part-time rate; the lows below sit above those day rates
 * pro-rated to 2.5 hours (cook, ₹6,420) and 1.5 hours (maid, ₹3,496). A 22 May 2026 revision (KA 411 LWA 2023) is
 * before the High Court and may raise them: check before the pilot.
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
