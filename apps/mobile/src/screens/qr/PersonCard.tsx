import { shownRecord } from "@gigsync/core";
import type { BoardProfile } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { Avatar, AvatarSize } from "../../ui/Avatar.js";
import { C } from "../../ui/cls.js";
import { areaLabel } from "../../ui/places.js";
import { Said } from "../../ui/Said.js";
import { cardHours, cardRateLine, cardWork, cardWorkRates } from "../../ui/work.js";
import { RecordBadges } from "../find/RecordBadges.js";
import { cardLang, languageNames } from "./cardWords.js";
import { RecordStats } from "./RecordStats.js";
import "./person.css";

const PARTS = " · ";

/**
 * A worker's board card as a QR or an offer shows it: name, trades, area, usual rate, languages, when they work, their
 * line, and the record the server vouched for (capped at what it saw delivered), when the worker shows one.
 */
export function WorkerCard({ card }: { card: BoardProfile }) {
  const i18n = useI18n();
  const { lang, t } = i18n;
  const hours = cardHours(i18n, card.work_hours);
  const record = shownRecord(card);
  return (
    <div className={C.stack}>
      <div className={C.row}>
        <Avatar name={card.display_name} size={AvatarSize.md} />
        <div className="who">
          <strong>{card.display_name}</strong>
          <span className={C.muted}>
            {cardWork(t, card)} · {areaLabel(lang, card.area_name)}
          </span>
          {card.languages.length > 0 && <span className={C.faint}>{languageNames(card.languages, t)}</span>}
          {hours && <span className={C.faint}>{hours}</span>}
        </div>
        <span className={`${C.money} end`}>{cardRateLine(t, card)}</span>
      </div>
      {cardWorkRates(t, card).map((rate) => (
        <span key={rate} className={C.faint}>
          {rate}
        </span>
      ))}
      {record && <RecordStats record={record} compact />}
      {card.about && (
        <span className={C.faint}>
          <Said text={card.about} from={cardLang(card)} />
        </span>
      )}
    </div>
  );
}

/**
 * A worker's card as a scan opens it (app-journey H14): their initial large in the middle, the name in the serif, their
 * work and area, the record as badges, then their usual rate with when they work; their other rates, languages and
 * line quieter under it. Only what the board card holds: no photo, and no ID or union badge.
 */
export function ScannedCard({ card }: { card: BoardProfile }) {
  const i18n = useI18n();
  const { lang, t } = i18n;
  const record = shownRecord(card);
  const rate = [cardRateLine(t, card), cardHours(i18n, card.work_hours)].filter(Boolean).join(PARTS);
  return (
    <div className="person-card">
      <Avatar name={card.display_name} size={AvatarSize.xl} />
      <h2 className="person-name">{card.display_name}</h2>
      <p className={C.muted}>
        {cardWork(t, card)}
        {PARTS}
        {areaLabel(lang, card.area_name)}
      </p>
      {record && <RecordBadges record={record} />}
      {rate && <p className="person-rate">{rate}</p>}
      {cardWorkRates(t, card).map((line) => (
        <span key={line} className={C.faint}>
          {line}
        </span>
      ))}
      {card.languages.length > 0 && <span className={C.faint}>{languageNames(card.languages, t)}</span>}
      {card.about && (
        <span className={C.faint}>
          <Said text={card.about} from={cardLang(card)} />
        </span>
      )}
    </div>
  );
}
