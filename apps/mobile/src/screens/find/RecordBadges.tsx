import { ratingShown } from "@gigsync/core";
import type { WorkerRecord } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import "./find.css";

/**
 * A worker's record as small badges, as Find's cards and a scanned card show it: jobs done, and the households' stars
 * once enough rated (ADR 0020 amendment). Still a description list, the same terms and figures as the record on My
 * card. Shown as it is: nothing is sorted or filtered by it, and there is no ID or union badge, since GigSync keeps no
 * such thing.
 */
export function RecordBadges({ record }: { record: WorkerRecord }) {
  const { lang, t, plural } = useI18n();
  return (
    <dl className="rec-badges" aria-label={t("record.card_label")}>
      <div className="badge">
        <dt className="rec-term">{t("record.card_jobs")}</dt>
        <dd>{plural("record.jobs_done", record.jobs)}</dd>
      </div>
      {ratingShown(record) && (
        <div className="badge rec-stars">
          <dt>{plural("record.card_rated", record.rated)}</dt>
          <dd>{t("record.card_stars", { stars: record.average.toLocaleString(lang) })}</dd>
        </div>
      )}
    </dl>
  );
}
