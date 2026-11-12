import { termText } from "@gigsync/core";
import { TermKey, type Terms } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon, type IconName } from "../../ui/Icon.js";

/** The space between a term and the faint note of what the owner asked, which JSX would otherwise drop. */
const GAP = " ";
const ROW = "term-row";
/** Each term's picture, so a reader can find the time or the materials without reading every line. */
const ICON: Readonly<Record<TermKey, IconName>> = {
  [TermKey.enum.when]: "calendar",
  [TermKey.enum.materials]: "wrench",
  [TermKey.enum.coats]: "brush",
  [TermKey.enum.hours]: "clock",
};

/**
 * The terms besides the price, one per line with its picture, in the owner's language (ADR 0033 §3). With `asked`
 * (the household's own request), a term the agents changed says what the owner asked for, and a line asks them to
 * check before signing. `place` adds where the work is as a last line of its own, outside the agreed terms. Nothing
 * at all when there is neither.
 */
export function TermsList({
  terms,
  asked,
  place,
}: {
  terms: Terms | undefined;
  asked?: Terms | undefined;
  place?: string | undefined;
}) {
  const { lang, t } = useI18n();
  const lines = TermKey.options.flatMap((key) => {
    const value = terms && termText(lang, key, terms);
    if (!value) return [];
    const wanted = asked && termText(lang, key, asked);
    return [{ key, value, wanted: wanted && wanted !== value ? wanted : undefined }];
  });
  if (lines.length === 0 && !place) return null;
  const changed = lines.some((l) => l.wanted);
  return (
    <div className={C.stack}>
      {lines.length > 0 && (
        <>
          <span className={C.label}>{t("terms.title")}</span>
          <ul className="terms" aria-label={t("terms.title")}>
            {lines.map((l) => (
              <li key={l.key} className={ROW} data-term={l.key} data-changed={l.wanted ? true : undefined}>
                <span className="term-icon">
                  <Icon name={ICON[l.key]} />
                </span>
                <span>
                  {l.value}
                  {l.wanted && (
                    <span className={C.faint}>
                      {GAP}
                      {t("terms.you_asked", { value: l.wanted })}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {place && (
        <p className={`${ROW} term-place`}>
          <span className="term-icon">
            <Icon name="pin" />
          </span>
          <span>{place}</span>
        </p>
      )}
      {changed && (
        <p className={C.muted} role="note">
          {t("terms.check")}
        </p>
      )}
    </div>
  );
}
