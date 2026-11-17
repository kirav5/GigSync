import { shownRecord } from "@gigsync/core";
import type { Arrangement, BoardWorker } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { Avatar, AvatarSize } from "../../ui/Avatar.js";
import { C } from "../../ui/cls.js";
import { areaLabel, money, unitKey } from "../../ui/places.js";
import { Said } from "../../ui/Said.js";
import { cardHours, cardRateLine, cardWork } from "../../ui/work.js";
import { cardLang, languageNames } from "../qr/cardWords.js";
import { RecordBadges } from "./RecordBadges.js";

const PARTS = " · ";

/**
 * One worker from the board as Find lists them: their initial, name, work, area and distance, a round tick that picks
 * them to ask (the native box sits over it, so a tap or a screen reader works it), their rate for the arrangement, and
 * the record the server vouched for when they show one. Languages, hours and their "about" line, in the reader's
 * language, follow quieter. The list keeps the board's order: the record never sorts or filters it.
 */
export function WorkerPick({
  worker: w,
  picked,
  disabled = false,
  onToggle,
  arrangement,
}: {
  worker: BoardWorker;
  /** The arrangement asked for (ADR 0046): the worker's rate for it, in its unit, instead of their main rate. */
  arrangement?: Arrangement | undefined;
  picked: boolean;
  /** The workers were asked already: the box shows who was picked, and no longer changes. */
  disabled?: boolean;
  onToggle: () => void;
}) {
  const i18n = useI18n();
  const { lang, t } = i18n;
  const record = shownRecord(w);
  const rate = arrangement && w.arrangements?.find((a) => a.arrangement === arrangement);
  const price = rate
    ? t("price.per", { price: money(rate.rate_paise), unit: t(unitKey(rate.arrangement)) })
    : cardRateLine(t, w);
  const more = [w.languages.length > 0 ? languageNames(w.languages, t) : undefined, cardHours(i18n, w.work_hours)];
  const quiet = more.filter(Boolean).join(PARTS);
  return (
    <label className={`${C.card} pick`} aria-label={t("a11y.worker", { name: w.display_name })}>
      <input
        type="checkbox"
        className="pick-box"
        aria-label={t("a11y.ask_worker", { name: w.display_name })}
        checked={picked}
        disabled={disabled}
        onChange={onToggle}
      />
      <span className="pick-head">
        <Avatar name={w.display_name} size={AvatarSize.md} />
        <span className="who">
          <strong className="pick-name">{w.display_name}</strong>
          <span className={C.muted}>
            {cardWork(t, w)}
            {PARTS}
            {areaLabel(lang, w.area_name)}
            {PARTS}
            {t("find.distance", { km: w.distance_km })}
          </span>
        </span>
        <span className="pick-tick" aria-hidden="true" />
      </span>
      <span className="row-between">
        <span className="pick-rate">{price}</span>
        {record && <RecordBadges record={record} />}
      </span>
      {quiet && <span className={C.faint}>{quiet}</span>}
      {w.about && (
        <span className={C.faint}>
          <Said text={w.about} from={cardLang(w)} />
        </span>
      )}
    </label>
  );
}
