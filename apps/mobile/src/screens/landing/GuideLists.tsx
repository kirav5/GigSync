import { type CityGuide, JourneyStep } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { ExternalLink, GUIDE_LANG, GuideText, SectionView } from "./SectionView.js";

const TEL = "tel:";
const LIST = "guide-list";
const SPACES = /\s+/g;

/** The guide's numbers, each a tap to call. */
export function Helplines({ guide }: { guide: CityGuide }) {
  const { t } = useI18n();
  const title = t("landing.helplines");
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <ul className={LIST}>
        {guide.helplines.map((h) => (
          <li key={h.number}>
            <a
              className="helpline"
              href={`${TEL}${h.number.replace(SPACES, "")}`}
              aria-label={t("landing.call", { name: h.name, number: h.number })}
            >
              <span className={C.money}>{h.number}</span> <GuideText text={h.name} original={false} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The guide's places, said plainly to be from public sources and vouched for by nobody. */
export function Places({ guide }: { guide: CityGuide }) {
  const { t } = useI18n();
  const title = t("landing.places");
  return (
    <details className={C.card}>
      <summary className={C.label}>{title}</summary>
      <section className={C.stack} aria-label={title}>
        <span className={C.muted}>{t("landing.places_note")}</span>
        <ul className={LIST}>
          {guide.places.map((p) => (
            <li key={p.name} className={C.stack}>
              <span className={C.faint}>{t(`landing.kind.${p.kind}`)}</span>
              <strong lang={GUIDE_LANG}>{p.name}</strong>
              <span lang={GUIDE_LANG}>{p.area}</span>
              <GuideText text={p.detail} />
              <ExternalLink href={p.source}>{t("landing.source")}</ExternalLink>
            </li>
          ))}
        </ul>
      </section>
    </details>
  );
}

/** The guide's registration sections (e-Shram, the state boards) with their official pages; the app files nothing. */
export function Registration({ guide }: { guide: CityGuide }) {
  const { t } = useI18n();
  const title = t("landing.register_title");
  const sections = guide.sections.filter((s) => s.step === JourneyStep.enum.registered);
  return (
    <details className={C.card}>
      <summary className={C.label}>{title}</summary>
      <section className={C.stack} aria-label={title}>
        <span className={C.muted}>{t("landing.register_note")}</span>
        {sections.map((s) => (
          <SectionView key={s.id} section={s} />
        ))}
      </section>
    </details>
  );
}

/** What the guide's writers could not confirm, so nobody relies on it unawares. */
export function NotChecked({ guide }: { guide: CityGuide }) {
  const { t } = useI18n();
  const title = t("landing.unchecked");
  return (
    <details className={C.card}>
      <summary className={C.label}>{title}</summary>
      <section className={C.stack} aria-label={title}>
        <span className={C.muted}>{t("landing.unchecked_note")}</span>
        <ul className={LIST}>
          {guide.needs_checking.map((n) => (
            <li key={n}>
              <GuideText text={n} />
            </li>
          ))}
        </ul>
      </section>
    </details>
  );
}
