import type { JobRecord } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { Avatar, AvatarSize, AvatarTone } from "../../ui/Avatar.js";
import { C } from "../../ui/cls.js";
import type { GigView } from "../../useGig.js";
import { rowWords, themOf } from "../activity/jobWords.js";
import { phoneDay } from "../jobGroups.js";
import "./recent.css";

/** How many of the household's latest jobs Home shows under the greeting. */
const RECENT = 3;

const newestFirst = (a: JobRecord, b: JobRecord) => b.engagement.updated_at.localeCompare(a.engagement.updated_at);

/**
 * The household's latest jobs on Home, under the greeting: one white card in the greeting rows' own style, a row each
 * with the person, the work and when, and the amount with the job's word ("Agreed", "Paid"). A tap opens Activity,
 * where each job is. Nothing at all before the first job.
 */
export function RecentJobs({ view, onOpen }: { view: GigView; onOpen: () => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const jobs = [...view.jobs].sort(newestFirst).slice(0, RECENT);
  if (jobs.length === 0) return null;
  const day = phoneDay(new Date());
  return (
    <section className="recent" aria-label={t("home.recent")}>
      <p className="recent-label">{t("home.recent")}</p>
      <div className="recent-card">
        {jobs.map((job) => {
          const name = themOf(job, view.names, t);
          const words = rowWords(i18n, job, { tasks: view.tasks, payments: view.payments, day, today: false });
          return (
            <button key={job.engagement.id} type={C.button} className="recent-row" onClick={onOpen}>
              <Avatar name={name} size={AvatarSize.sm} tone={AvatarTone.rust} />
              <span className="recent-text">
                <span className="recent-name">{name}</span>
                <span className="recent-line">{words.meta ? `${words.line} · ${words.meta}` : words.line}</span>
              </span>
              <span className="recent-end">
                {words.amount && <span className="recent-amount">{words.amount}</span>}
                <span className={`recent-word ${words.tone}`}>{words.word}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
