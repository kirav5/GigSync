import { estimateRequest, lineString, workOutlook } from "@gigsync/core";
import type { City, Trade } from "@gigsync/protocol";
import type { Account } from "../../adapters/account.js";
import { useEstimate } from "../../estimate/useEstimate.js";
import { useI18n } from "../../i18n.js";

/** The usual pay there, as one line, and the note that it is an estimate; undefined until a city and work are known. */
export interface GoingRates {
  line: string;
  note: string;
}

/**
 * The going rate for the worker's work in the city they are moving to, as Talk's move outlook builds it (core
 * moving/outlook.ts): the estimate when GigSync has one (ADR 0030), else the band the app ships for the city, else that
 * there are no figures. Only its first line is shown, with the outlook's own note that the figures are estimates.
 */
export function useGoingRates(
  account: Account,
  city: City | undefined,
  trade: Trade | undefined,
): GoingRates | undefined {
  const { lang } = useI18n();
  const found = useEstimate(account.session, city && trade ? estimateRequest(city, trade) : undefined);
  if (!city || !trade) return undefined;
  const { lines } = workOutlook({
    city,
    trades: [trade],
    own: lang,
    estimates: found ? { [trade]: found } : {},
    listed: {},
  });
  const [first] = lines;
  const last = lines.at(-1);
  if (!first || !last) return undefined;
  return { line: lineString(lang, first), note: lineString(lang, last) };
}
