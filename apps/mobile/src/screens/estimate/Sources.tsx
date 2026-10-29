import type { EstimateSource } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/**
 * The pages an estimate rests on, folded under "Sources": each site with the sentence quoted from it, linked, so a
 * worker, a household or a union can check every number. One entry per page.
 */
export function Sources({ sources }: { sources: readonly EstimateSource[] }) {
  const { t } = useI18n();
  const pages = [...new Map(sources.map((s) => [s.url, s])).values()];
  if (pages.length === 0) return null;
  return (
    <details className="estimate-sources">
      <summary>{t("estimate.sources")}</summary>
      <ul className={C.stack}>
        {pages.map((s) => (
          <li key={s.url} className={C.faint}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.site}
            </a>
            : “{s.sentence}”
          </li>
        ))}
      </ul>
    </details>
  );
}
