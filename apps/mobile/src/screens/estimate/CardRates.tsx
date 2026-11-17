import { areaSlug, CITY_RATES, estimateRequest, rateHint, rateNote, suggestForWorker } from "@gigsync/core";
import type { Place } from "@gigsync/protocol";
import { type Arrangement, DEFAULT_ARRANGEMENT, QuestionKey, type Session, type Trade } from "@gigsync/protocol";
import { cityOf } from "../../adapters/cities.js";
import { useEstimate } from "../../estimate/useEstimate.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { lineText } from "../talk/Bubbles.js";
import { EstimateBox } from "./EstimateBox.js";

/** The fields a suggestion fills on My card. */
const CardField = { rate: "rate", min: "min" } as const;

/**
 * Under My card's trades: for the first trade, the estimate for its default scope in the card's area, with what it
 * rests on and the opening and least amounts it suggests, which fill the rate fields on a tap (ADR 0030, ADR 0039);
 * for the others, or when there is no estimate, the city band and the legal minimum as before.
 */
export function CardRates({
  trades,
  area,
  place,
  session,
  onRate,
  onMin,
  arrangement,
  others = [],
  onOther,
}: {
  trades: readonly Trade[];
  /** The card's area key ("jayanagar"), when it has one. */
  area: string | undefined;
  /** Where the worker works (ADR 0061): the city it is in prices the card. */
  place?: Place | undefined;
  session: Session;
  onRate: (paise: number) => void;
  onMin: (paise: number) => void;
  /** ADR 0046: the arrangement the usual rate is for, and the others picked, each with its own estimate. */
  arrangement?: Arrangement | undefined;
  others?: readonly Arrangement[];
  onOther?: (arrangement: Arrangement, paise: number) => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const first = trades[0];
  const city = cityOf(place);
  const details = arrangement ? { [QuestionKey.enum.arrangement]: arrangement } : {};
  const found = useEstimate(session, first && estimateRequest(city, first, details, area && areaSlug(area)));
  const estimated = found && found.request.trade === first ? found : undefined;
  const suggested =
    estimated && suggestForWorker({ estimate: estimated.estimate, trade: estimated.request.trade, city: city });
  // The city band is monthly: not under a rate for an hour, a visit or a week.
  const monthly = arrangement === undefined || arrangement === DEFAULT_ARRANGEMENT;
  const banded = trades.filter((tr) => tr !== estimated?.request.trade && (monthly || tr !== first));
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
      {first &&
        others.map((a) => (
          <OtherEstimate
            place={place}
            key={a}
            trade={first}
            arrangement={a}
            area={area}
            session={session}
            onUse={(paise) => onOther?.(a, paise)}
          />
        ))}
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

/** The estimate for one more arrangement the worker picked, in its unit, and the rate it suggests for its field. */
function OtherEstimate({
  trade,
  arrangement,
  area,
  place,
  session,
  onUse,
}: {
  trade: Trade;
  arrangement: Arrangement;
  area: string | undefined;
  /** Where the worker works (ADR 0061): the city it is in prices the card. */
  place?: Place | undefined;
  session: Session;
  onUse: (paise: number) => void;
}) {
  const details = { [QuestionKey.enum.arrangement]: arrangement };
  const city = cityOf(place);
  const found = useEstimate(session, estimateRequest(city, trade, details, area && areaSlug(area)));
  if (!found || found.request.arrangement !== arrangement) return null;
  const suggested = suggestForWorker({ estimate: found.estimate, trade, city: city });
  return <EstimateBox found={found} suggested={[{ field: arrangement, paise: suggested.opening_paise, onUse }]} />;
}
