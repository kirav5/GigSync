import { type CityGuide, PlaceKind } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { ListCard } from "../../ui/ListRow.js";
import { ExternalLink, GUIDE_LANG, GuideText } from "../landing/SectionView.js";

const TEL = "tel:";
const SPACES = /\s+/g;

/** The guide's numbers as rows of one card, each a tap to call (as on the landing journey and No mentor). */
export function GuideLines({ guide }: { guide: CityGuide }) {
  const { t } = useI18n();
  if (guide.helplines.length === 0) return null;
  return (
    <ListCard label={t("mentor.helplines")}>
      {guide.helplines.map((h) => (
        <a
          key={h.number}
          className="list-row"
          href={`${TEL}${h.number.replace(SPACES, "")}`}
          aria-label={t("landing.call", { name: h.name, number: h.number })}
        >
          <span className="list-row-icon">
            <Icon name="call" size={20} />
          </span>
          <span className="list-row-text">
            <span className="list-row-title">
              <GuideText text={h.name} original={false} />
            </span>
            <span className={`list-row-sub ${C.money}`}>{h.number}</span>
          </span>
        </a>
      ))}
    </ListCard>
  );
}

/**
 * The unions the guide lists, as it lists them: the name, the area (whose office it marks not verified), what the
 * sources say, and the source. No steward, no "your union" and no call button: the guide gives no number, and GigSync is
 * no part of any union (ADR 0017 is not built).
 */
export function GuideUnions({ guide, city }: { guide: CityGuide; city: string }) {
  const { t } = useI18n();
  const unions = guide.places.filter((p) => p.kind === PlaceKind.enum.union);
  if (unions.length === 0) return null;
  const title = t("me.unions", { city });
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <ul className="help-unions">
        {unions.map((u) => (
          <li key={u.name} className={C.stack}>
            <strong className={C.title} lang={GUIDE_LANG}>
              {u.name}
            </strong>
            <span className={C.faint} lang={GUIDE_LANG}>
              {u.area}
            </span>
            <GuideText text={u.detail} />
            <ExternalLink href={u.source}>{t("landing.source")}</ExternalLink>
          </li>
        ))}
      </ul>
      <p className="fine">{t("me.unions_about")}</p>
    </section>
  );
}
