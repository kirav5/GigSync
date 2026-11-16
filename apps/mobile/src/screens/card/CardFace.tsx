import type { BoardProfile } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { Avatar, AvatarSize, AvatarTone } from "../../ui/Avatar.js";
import { Badge, BadgeTone } from "../../ui/Badge.js";
import { areaLabel } from "../../ui/places.js";
import { Said } from "../../ui/Said.js";
import { cardHours, cardRates, cardWorkRates } from "../../ui/work.js";
import { cardLang, languageNames } from "../qr/cardWords.js";
import "./card.css";

/** Between the languages and the days and hours on the face's last line. */
const PARTS = " · ";

/**
 * A worker's card as its earth face (W5, W6): their initial and name, the work they chose, their area and, on their
 * own phone, how far they go (the board does not show it); the Phone badge, because every account signs in with a
 * code sent to its number (GigSync checks nothing else yet, so it claims nothing else); then their rates, each in its
 * unit, the languages, days and hours they work, and their line, as households read it.
 */
export function CardFace({ card, km }: { card: BoardProfile; km?: number | undefined }) {
  const i18n = useI18n();
  const { lang, t } = i18n;
  const rates = [...cardRates(t, card), ...cardWorkRates(t, card)];
  const spoken = card.languages.length > 0 ? languageNames(card.languages, t) : undefined;
  const more = [spoken, cardHours(i18n, card.work_hours)].filter(Boolean).join(PARTS);
  return (
    <div className="card card-earth card-face">
      <div className="card-face-who">
        <Avatar name={card.display_name} size={AvatarSize.lg} tone={AvatarTone.rust} />
        <div className="card-face-words">
          <strong className="card-face-name">{card.display_name}</strong>
          <div className="card-face-line">
            <ul className="card-face-work" aria-label={t("card.what")}>
              {card.trades.map((tr) => (
                <li key={tr}>{t(`trade.${tr}`)}</li>
              ))}
              {card.skills?.map((s) => (
                <li key={s.text}>{s.text}</li>
              ))}
            </ul>
            <span>{areaLabel(lang, card.area_name)}</span>
            {km !== undefined && <span>{t("card.km", { km })}</span>}
          </div>
        </div>
      </div>
      <ul className="card-face-badges" aria-label={t("me.badges")}>
        <li>
          <Badge icon="check" tone={BadgeTone.checked}>
            {t("me.phone")}
          </Badge>
        </li>
      </ul>
      <div className="card-face-terms">
        {rates.map((rate) => (
          <span key={rate} className="card-face-rate">
            {rate}
          </span>
        ))}
        {more && <span className="fine">{more}</span>}
        {card.about && (
          <span className="fine">
            <Said text={card.about} from={cardLang(card)} />
          </span>
        )}
      </div>
    </div>
  );
}
