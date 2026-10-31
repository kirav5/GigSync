import { type Activity, ActivityTab, activityOf, countsOf, firstTab, groupJobs, type MessageKey } from "@gigsync/core";
import { type ReactNode, useId, useMemo, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { phoneDay } from "../jobGroups.js";
import { ActivityCounters, panelId, tabId } from "./ActivityCounters.js";
import { type CardProps, JobList, JobSection } from "./JobLists.js";
import "./activity.css";

/** What waits on the owner besides the jobs (a household's offers to work), shown first under Awaiting you. */
export interface MoreAwaiting {
  count: number;
  node: ReactNode;
}

/** The tab the owner picked, and how many things waited on them then. */
interface Pick {
  tab: ActivityTab;
  awaiting: number;
}

interface Props extends CardProps {
  now: Date;
  /** Above the counters: the worker's card and UPI nudges. */
  top?: ReactNode;
  more?: MoreAwaiting;
  /** Agreed by day (Today's jobs, Coming up, Other jobs) for a worker; one list for a household. */
  byDay: boolean;
  /** What to ask in the chat, said while there is nothing at all. */
  hint: MessageKey;
  onRecords: () => void;
}

/**
 * Activity, as collab's: "What your agents are doing", four counters (Awaiting you, In talks, Agreed, and Closed,
 * which opens Records), and the open tab's jobs. It opens on Awaiting you whenever something waits, and follows the
 * jobs until the owner picks a tab; a new decision brings Awaiting you back to the front. Finished jobs are never listed here: they live in Records. A job's agent talk
 * stays inside its own card, so there is no separate log.
 */
export function ActivityFrame({ now, top, more, byDay, hint, onRecords, ...card }: Props) {
  const { t, time, plural } = useI18n();
  const base = useId();
  const { jobs, tasks, payments, syncedAt } = card.view;
  const day = phoneDay(now);
  const activity = useMemo(() => activityOf(groupJobs({ jobs, tasks, payments, day })), [jobs, tasks, payments, day]);
  const counts = countsOf(activity, more?.count ?? 0);
  const [picked, setPicked] = useState<Pick>();
  // The owner's pick holds until something new waits on them: a new decision always comes to the front, and from
  // then on the tabs follow the jobs again.
  const held = picked !== undefined && counts.awaiting <= picked.awaiting;
  if (picked && !held) setPicked(undefined);
  const shown = held ? picked.tab : firstTab(counts);
  const pick = (tab: ActivityTab) => setPicked({ tab, awaiting: counts.awaiting });
  return (
    <>
      <div className={C.stack}>
        <h1 className={C.headline}>{t("activity.headline")}</h1>
        {syncedAt && <span className={C.faint}>{t("requests.checked", { time: time(syncedAt) })}</span>}
      </div>
      {top}
      <ActivityCounters base={base} counts={counts} shown={shown} onPick={pick} onRecords={onRecords} />
      <span className={C.muted}>
        {counts.awaiting > 0
          ? plural("activity.awaiting", counts.awaiting)
          : counts.talks > 0
            ? plural("activity.talking", counts.talks)
            : t("activity.standing_by")}
      </span>
      <div id={panelId(base)} role="tabpanel" aria-labelledby={tabId(base, shown)} className="radar-panel">
        <Panel shown={shown} activity={activity} more={more} byDay={byDay} {...card} />
      </div>
      {jobs.length + (more?.count ?? 0) === 0 && <p className={C.muted}>{t(hint)}</p>}
      <p className="activity-foot">
        <span className={C.faint}>{t("activity.records_line")}</span>
        <button type={C.button} className={C.linkBtn} onClick={onRecords}>
          {t("activity.records_open")}
        </button>
      </p>
    </>
  );
}

type PanelProps = CardProps & {
  shown: ActivityTab;
  activity: Activity;
  more: MoreAwaiting | undefined;
  byDay: boolean;
};

/** The open tab's jobs, or what it says when it has none. */
function Panel({ shown, activity, more, byDay, ...card }: PanelProps) {
  const { t } = useI18n();
  const empty = (key: MessageKey) => <p className={C.empty}>{t(key)}</p>;
  if (shown === ActivityTab.awaiting) {
    if (activity.awaiting.length + (more?.count ?? 0) === 0) return empty("activity.empty_awaiting");
    return (
      <>
        {more?.node}
        <JobList jobs={activity.awaiting} {...card} />
      </>
    );
  }
  if (shown === ActivityTab.talks) {
    return activity.talks.length === 0 ? empty("activity.empty_talks") : <JobList jobs={activity.talks} {...card} />;
  }
  const { today, upcoming, other } = activity.agreed;
  if (today.length + upcoming.length + other.length === 0) return empty("activity.empty_agreed");
  if (!byDay) return <JobSection title={t("home.jobs")} jobs={[...today, ...upcoming, ...other]} {...card} />;
  return (
    <>
      <JobSection title={t("home.today")} jobs={today} {...card} />
      <JobSection title={t("home.upcoming")} jobs={upcoming} {...card} />
      <JobSection title={t("home.other")} jobs={other} {...card} />
    </>
  );
}
