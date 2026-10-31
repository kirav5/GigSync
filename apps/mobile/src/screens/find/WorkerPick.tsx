import { shownRecord } from "@gigsync/core";
import type { BoardWorker } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { areaLabel, money } from "../../ui/places.js";
import { Said } from "../../ui/Said.js";
import { cardLang, languageNames } from "../qr/cardWords.js";
import { RecordStats } from "../qr/RecordStats.js";

/**
 * One worker from the board as Find lists them, with the box that picks them to ask, and the record the server
 * vouched for when they show one. Their "about" line is in the reader's language. The list keeps the board's order:
 * the record never sorts or filters it.
 */
export function WorkerPick({
  worker: w,
  picked,
  disabled = false,
  onToggle,
}: {
  worker: BoardWorker;
  picked: boolean;
  /** The workers were asked already: the box shows who was picked, and no longer changes. */
  disabled?: boolean;
  onToggle: () => void;
}) {
  const { lang, t } = useI18n();
  const record = shownRecord(w);
  return (
    <label className={C.card} aria-label={t("a11y.worker", { name: w.display_name })}>
      <div className={C.row}>
        <input
          type="checkbox"
          aria-label={t("a11y.ask_worker", { name: w.display_name })}
          checked={picked}
          disabled={disabled}
          onChange={onToggle}
        />
        <span className="avatar" aria-hidden="true">
          {w.display_name.slice(0, 1).toUpperCase()}
        </span>
        <div className="who">
          <strong>{w.display_name}</strong>
          <span className={C.muted}>
            {w.trades.map((tr) => t(`trade.${tr}`)).join(", ")} · {areaLabel(lang, w.area_name)} ·{" "}
            {t("find.distance", { km: w.distance_km })}
          </span>
          {w.languages.length > 0 && <span className={C.faint}>{languageNames(w.languages, t)}</span>}
        </div>
        <span className={`${C.money} end`}>{t("find.from", { price: money(w.rate_paise) })}</span>
      </div>
      {record && <RecordStats record={record} compact />}
      {w.about && (
        <span className={C.faint}>
          <Said text={w.about} from={cardLang(w)} />
        </span>
      )}
    </label>
  );
}
