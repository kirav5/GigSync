import { activityOf, countsOf, groupJobs, type JobRecord, type MessageKey } from "@gigsync/core";
import { type ReactNode, useId, useMemo } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { phoneDay } from "../jobGroups.js";
import type { CardProps } from "./JobLists.js";
import { JobRow } from "./JobRow.js";
import { useOpenRows } from "./useOpenRows.js";
import "./activity.css";

/** What waits on the owner besides the jobs (a household's offers to work), shown first under Needs you. */
export interface MoreAwaiting {
  count: number;
  node: ReactNode;
}

interface Props extends CardProps {
  now: Date;
  more?: MoreAwaiting;
  /** Agreed by day (Today's jobs, Coming up, Other jobs) for a worker; one list for a household. */
  byDay: boolean;
  /** What to ask in the chat, said while there is nothing at all. */
  hint: MessageKey;
  /** Opens the Money tab (Pay for a household), where finished jobs are. */
  onRecords: () => void;
}

/** A section's look: Needs you is drawn in rust, the other two plain. */
const NEEDS = "needs";

/**
 * The Jobs tab (design H6): three sections one under the other, in the order the owner must act: Needs you, Agents
 * talking, Agreed. Each job is one line that opens its card in place; a new decision's line opens by itself. Finished
 * jobs are never listed here: the foot leads to them on Money (Pay), where they are counted.
 */
export function ActivityFrame({ now, more, byDay, hint, onRecords, ...card }: Props) {
  const { t, time } = useI18n();
  const closedId = useId();
  const { jobs, tasks, payments, syncedAt } = card.view;
  const day = phoneDay(now);
  const activity = useMemo(() => activityOf(groupJobs({ jobs, tasks, payments, day })), [jobs, tasks, payments, day]);
  const counts = countsOf(activity, more?.count ?? 0);
  const rows = useOpenRows(tasks);
  const list = (shown: readonly JobRecord[], today = false) =>
    shown.length > 0 && (
      <ul className="job-rows">
        {shown.map((job) => {
          const id = job.engagement.id;
          return (
            <JobRow
              key={id}
              job={job}
              today={today}
              open={rows.isOpen(id)}
              onToggle={() => rows.toggle(id)}
              {...card}
            />
          );
        })}
      </ul>
    );
  const { today, upcoming, other } = activity.agreed;
  return (
    <>
      <h1 className="jobs-heading">{t("activity.headline")}</h1>
      <Group title="activity.tab_awaiting" empty={counts.awaiting === 0 && "activity.empty_awaiting"} look={NEEDS}>
        {more?.node}
        {list(activity.awaiting)}
      </Group>
      <Group title="activity.tab_talks" empty={counts.talks === 0 && "activity.empty_talks"}>
        {list(activity.talks)}
      </Group>
      <Group title="activity.tab_agreed" empty={counts.agreed === 0 && "activity.empty_agreed"}>
        {byDay ? (
          <>
            <Day title="home.today">{list(today, true)}</Day>
            <Day title="home.upcoming">{list(upcoming)}</Day>
            <Day title="home.other">{list(other)}</Day>
          </>
        ) : (
          list([...today, ...upcoming, ...other])
        )}
      </Group>
      {jobs.length + (more?.count ?? 0) === 0 && <p className={C.muted}>{t(hint)}</p>}
      <p className="activity-foot">
        <span className={C.faint}>{t("activity.records_line")}</span>
        <button
          type={C.button}
          className={C.linkBtn}
          aria-label={t("activity.tab_closed")}
          aria-describedby={closedId}
          onClick={onRecords}
        >
          {t("activity.tab_closed")} <b id={closedId}>{counts.closed}</b>
        </button>
        {syncedAt && <span className={C.faint}>{t("requests.checked", { time: time(syncedAt) })}</span>}
      </p>
    </>
  );
}

/** One of the three sections, named by its heading; what it says when it has nothing in it. */
function Group({
  title,
  empty,
  look,
  children,
}: {
  title: MessageKey;
  empty: MessageKey | false;
  look?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section className={`job-group ${look ?? ""}`} aria-labelledby={id}>
      <h2 id={id} className="section-label">
        {t(title)}
      </h2>
      {empty ? <p className="fine">{t(empty)}</p> : children}
    </section>
  );
}

/** A worker's day inside Agreed (Today's jobs, Coming up, Other jobs); nothing at all when it has no jobs. */
function Day({ title, children }: { title: MessageKey; children: ReactNode }) {
  const { t } = useI18n();
  if (!children) return null;
  return (
    <>
      <h3 className="job-day">{t(title)}</h3>
      {children}
    </>
  );
}
