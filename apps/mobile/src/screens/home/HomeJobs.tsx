import { activityOf, groupJobs, type JobRecord } from "@gigsync/core";
import { type ReactNode, useId, useMemo } from "react";
import { useI18n } from "../../i18n.js";
import type { GigView } from "../../useGig.js";
import { JobGlance } from "../activity/JobRow.js";
import { phoneDay } from "../jobGroups.js";

interface Props {
  view: GigView;
  now: Date;
  /** Between today's jobs and the talks: the worker's own bookings, which keep the agent off those hours. */
  bookings: ReactNode;
  /** Opens the Jobs tab, where each job's card and moves are. */
  onJobs: () => void;
}

/** A labelled group of job lines on Home; nothing at all without jobs. */
function Lines({
  label,
  jobs,
  today = false,
  view,
  onJobs,
}: { label: string; jobs: readonly JobRecord[]; today?: boolean } & Pick<Props, "view" | "onJobs">) {
  const id = useId();
  if (jobs.length === 0) return null;
  return (
    <section className="home-group" aria-labelledby={id}>
      <h2 id={id} className="section-label">
        {label}
      </h2>
      <ul className="job-rows">
        {jobs.map((job) => (
          <JobGlance key={job.engagement.id} job={job} view={view} today={today} onOpen={onJobs} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Home's jobs (design W7): today's agreed work, then who the agent is talking to with the turn it is on, each a line
 * that opens the Jobs tab. Filed as the Jobs tab files them, so a job is on Home only while it is there too. With
 * neither, one quiet line says the agent is standing by.
 */
export function HomeJobs({ view, now, bookings, onJobs }: Props) {
  const { t, plural } = useI18n();
  const { jobs, tasks, payments } = view;
  const day = phoneDay(now);
  const { agreed, talks } = useMemo(
    () => activityOf(groupJobs({ jobs, tasks, payments, day })),
    [jobs, tasks, payments, day],
  );
  return (
    <>
      <Lines label={t("home.today")} jobs={agreed.today} today view={view} onJobs={onJobs} />
      {bookings}
      <Lines label={plural("activity.talking", talks.length)} jobs={talks} view={view} onJobs={onJobs} />
      {agreed.today.length + talks.length === 0 && <p className="fine">{t("activity.standing_by")}</p>}
    </>
  );
}
