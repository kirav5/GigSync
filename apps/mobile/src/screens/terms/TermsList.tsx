import { termText } from "@gigsync/core";
import { TermKey, type Terms } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/** The space between a term and the faint note of what the owner asked, which JSX would otherwise drop. */
const GAP = " ";

/**
 * The terms besides the price, one per line, in the owner's language (ADR 0033 §3). With `asked` (the household's
 * own request), a term the agents changed says what the owner asked for, and a line asks them to check before
 * signing. Nothing at all when there are no terms.
 */
export function TermsList({ terms, asked }: { terms: Terms | undefined; asked?: Terms | undefined }) {
  const { lang, t } = useI18n();
  if (!terms) return null;
  const lines = TermKey.options.flatMap((key) => {
    const value = termText(lang, key, terms);
    if (!value) return [];
    const wanted = asked && termText(lang, key, asked);
    return [{ key, value, wanted: wanted && wanted !== value ? wanted : undefined }];
  });
  if (lines.length === 0) return null;
  const changed = lines.some((l) => l.wanted);
  return (
    <div className={C.stack}>
      <span className={C.label}>{t("terms.title")}</span>
      <ul className="terms" aria-label={t("terms.title")}>
        {lines.map((l) => (
          <li key={l.key} data-term={l.key} data-changed={l.wanted ? true : undefined}>
            {l.value}
            {l.wanted && (
              <span className={C.faint}>
                {GAP}
                {t("terms.you_asked", { value: l.wanted })}
              </span>
            )}
          </li>
        ))}
      </ul>
      {changed && (
        <p className={C.muted} role="note">
          {t("terms.check")}
        </p>
      )}
    </div>
  );
}
