import type { BoardProfile, WorkerRecord } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { areaLabel, money } from "../../ui/places.js";
import { Said } from "../../ui/Said.js";
import { cardLang, languageNames } from "./cardWords.js";
import { Initial } from "./PersonCard.js";
import { RecordStats } from "./RecordStats.js";

interface WorkerTopProps {
  name: string;
  /** The card on the board, or none yet / taken off. */
  card: BoardProfile | undefined;
  /** Why there is no card: none made yet, or taken off the board. */
  missing: string;
  /** The owner's own record, counted on this phone. */
  record: WorkerRecord;
  /** The owner chose to keep it off their card (Privacy): households do not see it. */
  hidden: boolean;
}

/**
 * The top of a worker's My card, centred as collab's: their initial, name, trades and area, languages, usual rate and
 * line, then their record as this phone counts it. Households see the same card, with the record the server capped.
 */
export function WorkerTop({ name, card, missing, record, hidden }: WorkerTopProps) {
  const { lang, t } = useI18n();
  return (
    <>
      <div className="share-top">
        <Initial name={name} large />
        <strong className="share-name">{name}</strong>
        {card ? (
          <>
            <span className={C.muted}>
              {card.trades.map((tr) => t(`trade.${tr}`)).join(", ")} · {areaLabel(lang, card.area_name)}
            </span>
            {card.languages.length > 0 && <span className={C.faint}>{languageNames(card.languages, t)}</span>}
            <span className={C.money}>{t("find.from", { price: money(card.rate_paise) })}</span>
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
      <RecordStats record={record} />
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
