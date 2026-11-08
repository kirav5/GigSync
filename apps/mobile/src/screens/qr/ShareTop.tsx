import type { BoardProfile, WorkerRecord } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { areaLabel } from "../../ui/places.js";
import { Said } from "../../ui/Said.js";
import { cardHours, cardRates, cardWorkRates } from "../../ui/work.js";
import { cardLang, languageNames } from "./cardWords.js";
import { Initial } from "./PersonCard.js";
import { RecordStats } from "./RecordStats.js";

interface WorkerTopProps {
  name: string;
  /** The card on the board, or none yet / taken off. */
  card: BoardProfile | undefined;
  /** Why there is no card: none made yet, or taken off the board. */
  missing: string;
  /** The owner's own record as GigSync keeps it; undefined until this phone has read it once. */
  record: WorkerRecord | undefined;
  /** The owner chose to keep it off their card (Privacy): households do not see it. */
  hidden: boolean;
}

/**
 * The top of a worker's My card, centred as collab's: their initial and name, the work they chose as chips, their area,
 * languages, days and hours, a rate for each arrangement in its unit, and their line (ADR 0053 §7); then their record as
 * GigSync keeps it. Households see the same card, with the same record unless it is hidden.
 */
export function WorkerTop({ name, card, missing, record, hidden }: WorkerTopProps) {
  const i18n = useI18n();
  const { lang, t } = i18n;
  const hours = card && cardHours(i18n, card.work_hours);
  return (
    <>
      <div className="share-top">
        <Initial name={name} large />
        <strong className="share-name">{name}</strong>
        {card ? (
          <>
            <ul className="share-chips" aria-label={t("card.what")}>
              {card.trades.map((tr) => (
                <li key={tr} className={C.chipOn}>
                  {t(`trade.${tr}`)}
                </li>
              ))}
              {card.skills?.map((s) => (
                <li key={s.text} className={C.chipOn}>
                  {s.text}
                </li>
              ))}
            </ul>
            <span className={C.muted}>{areaLabel(lang, card.area_name)}</span>
            {card.languages.length > 0 && <span className={C.faint}>{languageNames(card.languages, t)}</span>}
            {hours && <span className={C.faint}>{hours}</span>}
            {[...cardRates(t, card), ...cardWorkRates(t, card)].map((rate) => (
              <span key={rate} className={C.money}>
                {rate}
              </span>
            ))}
            {card.about && (
              <span className={C.muted}>
                <Said text={card.about} from={cardLang(card)} />
              </span>
            )}
          </>
        ) : (
          <span className={C.muted}>{missing}</span>
        )}
      </div>
      {record && <RecordStats record={record} />}
      {hidden && <span className={C.faint}>{t("record.card_hidden")}</span>}
    </>
  );
}

/** The top of a household's My card: the first name a scanning worker sees, and that it is a household. */
export function HouseholdTop({ name }: { name: string }) {
  const { t } = useI18n();
  return (
    <div className="share-top">
      <Initial name={name} large />
      <strong className="share-name">{name}</strong>
      <span className={C.muted}>{t("qr.household")}</span>
    </div>
  );
}
