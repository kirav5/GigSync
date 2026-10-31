import type { GuideSection, GuideSource } from "@gigsync/protocol";
import { Lang } from "@gigsync/protocol";
import { type ReactNode, useState } from "react";
import { copyText } from "../../adapters/clipboard.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Said } from "../../ui/Said.js";

/** The guide is written in English; every other reader gets the phone's translation, with the original a tap away. */
export const GUIDE_LANG = Lang.enum.en;
const NEW_TAB = "_blank";
const NO_OPENER = "noopener noreferrer";

/** A public page, opened outside the app. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target={NEW_TAB} rel={NO_OPENER}>
      {children}
    </a>
  );
}

/**
 * Words from the guide in the reader's language. A reader of another language can open the English as written
 * (`original`), for a block of text; a title or a line inside a sentence passes `original={false}`.
 */
export function GuideText({ text, original = true }: { text: string; original?: boolean }) {
  const { lang, t } = useI18n();
  if (lang === GUIDE_LANG) return <span>{text}</span>;
  if (!original) return <Said text={text} from={GUIDE_LANG} />;
  return (
    <>
      <Said text={text} from={GUIDE_LANG} />
      <details className="as-written">
        <summary className={C.faint}>{t("landing.as_written")}</summary>
        <span lang={GUIDE_LANG}>{text}</span>
      </details>
    </>
  );
}

/** Where a section's facts come from: each public page as a link, with the day it was read. */
export function Sources({ sources }: { sources: readonly GuideSource[] }) {
  const { t, date } = useI18n();
  return (
    <div className="guide-sources">
      <span className={C.label}>{t("landing.sources")}</span>
      <ul>
        {sources.map((s) => (
          <li key={s.url + s.title}>
            <ExternalLink href={s.url}>
              {t("landing.source_read", { title: s.title, date: date(new Date(s.read)) })}
            </ExternalLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The words to show at a counter, with a button that copies them as written. */
function Quote({ quote }: { quote: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="guide-quote">
      <blockquote lang={GUIDE_LANG}>{quote}</blockquote>
      <button type={C.button} className={C.secondary} onClick={() => void copyText(quote).then(setCopied)}>
        {t("landing.copy_say")}
      </button>
      {copied && (
        <span className={C.muted} role="status">
          {t("landing.copied")}
        </span>
      )}
    </div>
  );
}

/** One section of the guide as written: its words, the words to say where it has them, and its sources. */
export function SectionBody({ section }: { section: GuideSection }) {
  return (
    <div className={C.stack}>
      <div className="guide-body">
        <GuideText text={section.body} />
      </div>
      {section.quote && <Quote quote={section.quote} />}
      <Sources sources={section.sources} />
    </div>
  );
}

/** A whole section with its title, as "Ask the guide" answers. */
export function SectionView({ section }: { section: GuideSection }) {
  return (
    <article className="guide-section" aria-label={section.title}>
      <h3 className={C.title}>
        <GuideText text={section.title} original={false} />
      </h3>
      <SectionBody section={section} />
    </article>
  );
}
