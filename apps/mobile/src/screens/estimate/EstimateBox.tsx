import { estimateLines, type FoundEstimate } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";
import { lineText } from "../talk/Bubbles.js";
import { RangeBand } from "./RangeBand.js";

/** One suggested amount and what it is for; tapping it puts the amount in that field, for the owner to keep or change. */
export interface Suggested {
  /** Which field it fills, unique in the box. */
  field: string;
  paise: number;
  onUse: (paise: number) => void;
}

/**
 * An estimate on a form (My card, Find's form): the usual range as a band, the range in words with what it rests on,
 * and the amounts it suggests as buttons that fill a field. Nothing is filled until the owner taps.
 */
export function EstimateBox({ found, suggested }: { found: FoundEstimate; suggested: readonly Suggested[] }) {
  const i18n = useI18n();
  const { t } = i18n;
  return (
    <section className={`${C.stack} estimate`}>
      <RangeBand found={found} />
      {estimateLines(i18n.lang, found).map((line) => (
        <span key={line.key} className={C.faint}>
          {lineText(i18n, line)}
        </span>
      ))}
      <div className={C.row}>
        {suggested.map((s) => (
          <button key={s.field} type={C.button} className={C.chip} onClick={() => s.onUse(s.paise)}>
            {t("estimate.use", { price: money(s.paise) })}
          </button>
        ))}
      </div>
    </section>
  );
}
