import type { Lang } from "@gigsync/protocol";
import { type Reason, ReasonKind } from "../job/advice.js";
import { plural, t } from "./t.js";

const RUPEES = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const PAISE_PER_RUPEE = 100;

/** "₹8,300" from 830000 paise. Western digits in every language: what UPI apps and price tags show. */
export const priceText = (paise: number): string => RUPEES.format(Math.round(paise / PAISE_PER_RUPEE));

/** One reason behind a price plan, as a sentence in the owner's language, for the confirm card and the voice. */
export function reasonText(lang: Lang, r: Reason): string {
  switch (r.kind) {
    case ReasonKind.band: {
      const range = { low: priceText(r.low_paise), high: priceText(r.high_paise) };
      if (r.jobs !== undefined) return plural(lang, "estimate.reason_jobs", r.jobs, range);
      return r.sources === undefined
        ? t(lang, "reason.band", range)
        : plural(lang, "estimate.reason", r.sources, range);
    }
    case ReasonKind.scope:
      return t(lang, "reason.scope", { percent: r.percent, item: t(lang, `detail.${r.key}`) });
    case ReasonKind.history:
      return t(lang, "reason.history", { median: priceText(r.median_paise), count: r.count });
    case ReasonKind.floor:
      return t(lang, "reason.floor", { floor: priceText(r.floor_paise) });
    case ReasonKind.plan:
      return t(lang, "reason.plan", { opening: priceText(r.opening_paise), limit: priceText(r.limit_paise) });
  }
}
