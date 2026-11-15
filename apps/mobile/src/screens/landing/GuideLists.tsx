import { type CityGuide, JourneyStep } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { CallRows } from "../help/CallRows.js";
import { ExternalLink, GUIDE_LANG, GuideText, SectionView } from "./SectionView.js";

const LIST = "guide-list";
/** A fold of the guide: a card whose summary reads as a row with a chevron that turns when open. */
const FOLD = `${C.card} guide-fold`;

/** The guide's numbers, each a tap to call, as rows like Help's. */
export function Helplines({ guide }: { guide: CityGuide }) {
  const { t } = useI18n();
  const lines = guide.helplines.map((h) => ({
    name: <GuideText text={h.name} original={false} />,
    said: h.name,
    number: h.number,
  }));
  return <CallRows label={t("landing.helplines")} lines={lines} />;
}

/** The guide's places, said plainly to be from public sources and vouched for by nobody. */
export function Places({ guide }: { guide: CityGuide }) {
  const { t } = useI18n();
  const title = t("landing.places");
  return (
    <details className={FOLD}>
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
    <details className={FOLD}>
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
    <details className={FOLD}>
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
