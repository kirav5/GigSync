import { shownRecord } from "@gigsync/core";
import type { BoardProfile } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { areaLabel, money } from "../../ui/places.js";
import { Said } from "../../ui/Said.js";
import { cardLang, languageNames } from "./cardWords.js";
import { RecordStats } from "./RecordStats.js";

/**
 * A worker's board card as a QR or an offer shows it: name, trades, area, usual rate, languages, their line, and the
 * record the server vouched for (capped at what it saw delivered), when the worker shows one.
 */
export function WorkerCard({ card }: { card: BoardProfile }) {
  const { lang, t } = useI18n();
  const record = shownRecord(card);
  return (
    <div className={C.stack}>
      <div className={C.row}>
        <Initial name={card.display_name} />
        <div className="who">
          <strong>{card.display_name}</strong>
          <span className={C.muted}>
            {card.trades.map((tr) => t(`trade.${tr}`)).join(", ")} · {areaLabel(lang, card.area_name)}
          </span>
          {card.languages.length > 0 && <span className={C.faint}>{languageNames(card.languages, t)}</span>}
        </div>
        <span className={`${C.money} end`}>{t("find.from", { price: money(card.rate_paise) })}</span>
      </div>
      {record && <RecordStats record={record} compact />}
      {card.about && (
        <span className={C.faint}>
          <Said text={card.about} from={cardLang(card)} />
        </span>
      )}
    </div>
  );
}

/** A person's first letter in the accent square, as Find shows workers; `large` on My card. */
export function Initial({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span className={large ? "avatar large" : "avatar"} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
