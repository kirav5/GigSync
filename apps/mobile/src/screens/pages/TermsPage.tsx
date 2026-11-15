import { LOCALE } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { useEffect } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { TERMS_SECTIONS, TERMS_UPDATED, type TermsBlock, type TermsItem, type TermsSection } from "./terms/sections.js";
import "./terms/terms.css";

const { en } = Lang.enum;
const LONG_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
/** Read as local midday, so the date is the same day in every time zone. */
const MIDDAY = "T12:00:00";
const anchorOf = (id: string) => `legal-${id}`;

/**
 * Where "Terms and Privacy Notice" leads, from the sign-in line and from Settings (ADR 0039 §4): one long readable
 * page, as the big home-services apps show theirs. The date it last changed, a contents list that jumps to each
 * section, then the numbered sections: each one's title and summary in the reader's language, its full text in
 * English. From Settings the shell's top bar has the title and Back; from sign-in, which has no top bar, the page
 * draws its own (`onBack`), over the form, which keeps what was typed.
 */
export function TermsPage({ onBack }: { onBack?: () => void }) {
  const { lang, t } = useI18n();
  const title = t("records.terms_title");
  // Opened over the sign-in form, the page starts at its top, wherever the form was scrolled to.
  useEffect(() => {
    if (onBack) window.scrollTo(0, 0);
  }, [onBack]);
  return (
    <section className="legal" aria-label={title}>
      {onBack && (
        <div className="legal-bar">
          <button type={C.button} className="legal-back" aria-label={t("a11y.back")} onClick={onBack}>
            <Icon name="back" size={22} />
          </button>
          <h1 className="legal-title">{title}</h1>
        </div>
      )}
      <p className={C.muted}>
        {t("legal.updated", {
          date: new Date(`${TERMS_UPDATED}${MIDDAY}`).toLocaleDateString(LOCALE[lang], LONG_DATE),
        })}
      </p>
      {lang !== en && <p className="legal-note">{t("legal.english_only")}</p>}
      <nav className="legal-contents" aria-label={t("legal.contents")}>
        <h2 className="legal-contents-title">{t("legal.contents")}</h2>
        <ol>
          {TERMS_SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                type={C.button}
                className={C.linkBtn}
                onClick={() => document.getElementById(anchorOf(s.id))?.scrollIntoView({ block: "start" })}
              >
                {s.number}. {t(s.title)}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      {TERMS_SECTIONS.map((s) => (
        <SectionView key={s.id} section={s} english={lang === en} />
      ))}
    </section>
  );
}

/** One numbered section: its heading and summary in the reader's language, then its full English text. */
function SectionView({ section, english }: { section: TermsSection; english: boolean }) {
  const { t } = useI18n();
  return (
    <div className="legal-section" id={anchorOf(section.id)}>
      <h2 className="legal-heading">
        {section.number}. {t(section.title)}
      </h2>
      <p className="legal-summary">{t(section.summary)}</p>
      <div className="legal-body" {...(english ? {} : { lang: en })}>
        {section.body.map((block) => (
          <Block key={keyOf(block)} block={block} />
        ))}
      </div>
    </div>
  );
}

/** A paragraph, or a list of bullets each with its bold lead. */
function Block({ block }: { block: TermsBlock }) {
  if (typeof block === "string") return <p>{block}</p>;
  return (
    <ul className="legal-list">
      {block.map((item) => (
        <li key={keyOf(item)}>
          {typeof item === "string" ? (
            item
          ) : (
            <>
              <strong>{item[0]}</strong> {item[1]}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

/** A block's or bullet's own words, as its key: the text is fixed and no two are the same. */
function keyOf(part: TermsBlock | TermsItem): string {
  if (typeof part === "string") return part;
  const [first] = part;
  return typeof first === "string" ? first : (first?.[0] ?? "");
}
