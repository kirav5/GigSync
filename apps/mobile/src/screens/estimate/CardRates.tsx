import { CITY_RATES, estimateRequest, rateHint, rateNote, suggestForWorker } from "@gigsync/core";
import type { Session, Trade } from "@gigsync/protocol";
import { useEstimate } from "../../estimate/useEstimate.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { PILOT_CITY } from "../../ui/places.js";
import { lineText } from "../talk/Bubbles.js";
import { EstimateBox } from "./EstimateBox.js";

/** The fields a suggestion fills on My card. */
const CardField = { rate: "rate", min: "min" } as const;

/**
 * Under My card's trades: for the first trade, the estimate for its default scope with its sources and the opening
 * and least amounts it suggests, which fill the rate fields on a tap (ADR 0030); for the others, or when there is no
 * estimate, the city band and the legal minimum as before.
 */
export function CardRates({
  trades,
  session,
  onRate,
  onMin,
}: {
  trades: readonly Trade[];
  session: Session;
  onRate: (paise: number) => void;
  onMin: (paise: number) => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const first = trades[0];
  const found = useEstimate(session, first && estimateRequest(PILOT_CITY, first));
  const estimated = found && found.request.trade === first ? found : undefined;
  const suggested =
    estimated && suggestForWorker({ estimate: estimated.estimate, trade: estimated.request.trade, city: PILOT_CITY });
  const banded = trades.filter((tr) => tr !== estimated?.request.trade);
  return (
    <>
      {estimated && suggested && (
        <EstimateBox
          found={estimated}
          suggested={[
            { field: CardField.rate, paise: suggested.opening_paise, onUse: onRate },
            { field: CardField.min, paise: suggested.limit_paise, onUse: onMin },
          ]}
        />
      )}
      {banded.flatMap((tr) =>
        rateHint(CITY_RATES, tr).map((line) => (
          <span key={`${tr}.${line.key}`} className={C.faint}>
            {lineText(i18n, line)}
          </span>
        )),
      )}
      {(estimated || CITY_RATES.bands.some((b) => trades.includes(b.trade))) && (
        <span className={C.faint}>{t("card.band_use")}</span>
      )}
      {rateNote(CITY_RATES, banded).map((line) => (
        <span key={line.key} className={C.faint}>
          {lineText(i18n, line)}
        </span>
      ))}
    </>
  );
}
