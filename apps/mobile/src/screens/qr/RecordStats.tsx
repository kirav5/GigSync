import { ratingShown } from "@gigsync/core";
import type { WorkerRecord } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";

/**
 * A worker's record as three cells, as collab's card: jobs done, the households' average with how many rated (only
 * once enough did), and how many households came back. Shown as it is; nothing is ever sorted or filtered by it.
 */
export function RecordStats({ record, compact = false }: { record: WorkerRecord; compact?: boolean }) {
  const { lang, t, plural } = useI18n();
  const rated = ratingShown(record);
  return (
    <dl className={compact ? "share-stats compact" : "share-stats"} aria-label={t("record.card_label")}>
      <div>
        <dt>{t("record.card_jobs")}</dt>
        <dd>{record.jobs}</dd>
      </div>
      <div>
        <dt>{rated ? plural("record.card_rated", record.rated) : t("record.card_not_rated")}</dt>
        <dd>
          {rated ? t("record.card_stars", { stars: record.average.toLocaleString(lang) }) : t("record.card_no_stars")}
        </dd>
      </div>
      <div>
        <dt>{t("record.card_came_back")}</dt>
        <dd>{record.came_back}</dd>
      </div>
    </dl>
  );
}
