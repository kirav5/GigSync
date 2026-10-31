import type { Lang, Trade } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/** What a newcomer reads about a mentor, from the match or their offer. */
export interface MentorFactsOf {
  trades: readonly Trade[];
  languages: readonly Lang[];
  months: number;
  jobs: number;
  vouched_by?: string | null;
  area?: string;
}

/**
 * A mentor's work, languages and area, their own count of jobs and months (said plainly to be their own phone's
 * count, which nobody checked), and the vouched badge where a union or NGO vouches for them.
 */
export function MentorFacts({ facts }: { facts: MentorFactsOf }) {
  const { t } = useI18n();
  const work = facts.trades.map((tr) => t(`trade.${tr}`)).join(", ");
  const langs = facts.languages.map((l) => t(`lang.${l}`)).join(", ");
  return (
    <span className="mentor-facts">
      <span>{facts.area ? `${work} · ${facts.area}` : work}</span>
      <span className={C.muted}>{t("mentor.speaks", { langs })}</span>
      <span>
        {t("mentor.says", { jobs: facts.jobs, months: facts.months })}{" "}
        <span className={C.faint}>{t("mentor.own_count")}</span>
      </span>
      {facts.vouched_by && <span className="mentor-vouched">{t("mentor.vouched", { name: facts.vouched_by })}</span>}
    </span>
  );
}
