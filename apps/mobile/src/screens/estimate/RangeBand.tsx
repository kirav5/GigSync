import type { FoundEstimate, MessageKey } from "@gigsync/core";
import { RateUnit } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { EstimateBand } from "./EstimateBand.js";

const U = RateUnit.enum;

/** What the typical amount over the band is per: "₹450 a visit", "₹9,000 a month". */
const UNIT: Readonly<Record<RateUnit, MessageKey>> = {
  [U.hour]: "unit.hour",
  [U.visit]: "unit.visit",
  [U.week]: "unit.week",
  [U.month]: "unit.month",
  [U.day]: "cardflow.unit_day",
  [U.job]: "cardflow.unit_job",
  [U.sqft]: "cardflow.unit_sqft",
};

/**
 * An estimate's usual range drawn as the band (low, typical, high, in its unit), for the card chat's price question
 * and My card's form. The words about it (the range, what it rests on, the legal minimum) are the caller's to show.
 */
export function RangeBand({ found }: { found: FoundEstimate }) {
  const { t } = useI18n();
  const { low_paise, typical_paise, high_paise, unit } = found.estimate;
  return <EstimateBand low={low_paise} typical={typical_paise} high={high_paise} unit={t(UNIT[unit])} />;
}
