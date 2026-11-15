import { activityOf, countsOf, groupJobs, type JobRecord, type MessageKey } from "@gigsync/core";
import { type ReactNode, useMemo } from "react";
import { useI18n } from "../../i18n.js";
import { phoneDay } from "../jobGroups.js";
import { Day, DoneGroup, EmptyJobs, Foot, Group } from "./ActivityParts.js";
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
  /** What to ask in the chat, said while there are no jobs at all. */
  hint: MessageKey;
  /** Opens the Money tab (Pay for a household), where finished jobs are kept. */
  onRecords: () => void;
  /** What the owner alone is asked, under the heading (a worker's nudges). */
  lead?: ReactNode;
}

/** A section's look: Needs you is drawn in rust, the others plain. */
const NEEDS = "needs";

/**
 * The Jobs tab, for both owners, laid out as an activity page: what needs the owner first, then what the agents are
 * talking over, then the work agreed by day (Today, Coming up, Other days), then the latest finished jobs by the day
 * they were finished. Each job is a compact card (the person, the work, a status pill, when, the amount) that opens
 * its whole card in place; a new decision's card opens by itself. A section with nothing in it is not drawn.
 */
export function ActivityFrame({ now, more, hint, onRecords, lead, ...card }: Props) {
  const { t, time } = useI18n();
  const { jobs, tasks, payments, syncedAt } = card.view;
  const day = phoneDay(now);
  const activity = useMemo(() => activityOf(groupJobs({ jobs, tasks, payments, day })), [jobs, tasks, payments, day]);
  const counts = countsOf(activity, more?.count ?? 0);
  const rows = useOpenRows(tasks);
  const list = (shown: readonly JobRecord[], { today = false, decide = false } = {}) =>
    shown.length > 0 && (
      <ul className="job-rows">
        {shown.map((job) => {
          const id = job.engagement.id;
          return (
            <JobRow
              key={id}
              job={job}
              day={day}
              today={today}
              decide={decide}
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
      {lead}
      {jobs.length + (more?.count ?? 0) === 0 && <EmptyJobs hint={hint} />}
      <Group title="activity.tab_awaiting" count={counts.awaiting} look={NEEDS}>
        {more?.node}
        {list(activity.awaiting, { decide: true })}
      </Group>
      <Group title="activity.tab_talks" count={counts.talks}>
        {list(activity.talks)}
      </Group>
      <Group title="activity.tab_agreed" count={counts.agreed}>
        <Day title="schedule.today">{list(today, { today: true })}</Day>
        <Day title="jobs.day.coming">{list(upcoming)}</Day>
        <Day title="jobs.day.other">{list(other)}</Day>
      </Group>
      <DoneGroup jobs={activity.records.done} view={card.view} today={day} onOpen={onRecords} />
      <Foot closed={counts.closed} checked={syncedAt && time(syncedAt)} onOpen={onRecords} />
    </>
  );
}
