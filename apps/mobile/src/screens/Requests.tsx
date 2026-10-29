import type { GigDevice, JobRecord } from "@gigsync/core";
import { useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import type { GigView } from "../useGig.js";
import type { JobActionProps } from "./JobActions.js";
import { JobThread } from "./JobThread.js";
import { groupJobs, phoneDay } from "./jobGroups.js";
import "./jobs.css";

interface Props {
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
}

/** What every job card in a list needs, besides the job. */
type ListProps = Omit<JobActionProps, "job"> & { jobs: readonly JobRecord[] };

/**
 * The consumer's jobs: what to decide now (answer the worker, sign, say whether a payment went), the jobs
 * agreed (pay, review), then folded away the requests the agents are still talking over, and the past.
 */
export function Requests({ view, device, run }: Props) {
  const { t, time, plural } = useI18n();
  const now = new Date();
  const g = groupJobs({ jobs: view.jobs, tasks: view.tasks, payments: view.payments, day: phoneDay(now) });
  const list = { view, device, run };
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("nav.my_jobs")}</span>
        <h1 className={C.headline}>
          {t("requests.headline_consumer")} <span className={C.soft}>{t("requests.soft")}</span>
        </h1>
        {view.syncedAt && <span className={C.faint}>{t("requests.checked", { time: time(view.syncedAt) })}</span>}
      </div>
      {view.jobs.length === 0 && <div className={C.empty}>{t("requests.empty_consumer")}</div>}
      <JobSection title={t("home.decide")} jobs={g.decide} {...list} />
      <JobSection title={t("home.jobs")} jobs={[...g.today, ...g.upcoming, ...g.other]} {...list} />
      <JobFold summary={plural("home.talking_workers", g.talking.length)} jobs={g.talking} {...list} />
      <JobFold summary={t("home.earlier")} jobs={g.earlier} {...list} />
    </>
  );
}

/** A headed list of job cards. Empty, it shows `empty` under the heading, or nothing at all when there is none. */
export function JobSection({ title, jobs, empty, ...card }: ListProps & { title: string; empty?: string }) {
  if (jobs.length === 0 && empty === undefined) return null;
  return (
    <section className="job-section">
      <h2>{title}</h2>
      {jobs.length === 0 ? (
        <span className={C.muted}>{empty}</span>
      ) : (
        jobs.map((job) => <JobThread key={job.engagement.id} job={job} {...card} />)
      )}
    </section>
  );
}

/**
 * Jobs that need nothing from the owner now, folded under `summary`. The cards are built only once it is opened:
 * each one translates the other side's words on this phone, and history only grows.
 */
export function JobFold({ summary, jobs, ...card }: ListProps & { summary: string }) {
  const [open, setOpen] = useState(false);
  if (jobs.length === 0) return null;
  return (
    <details className="job-fold" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{summary}</summary>
      {open && (
        <div className={C.stack}>
          {jobs.map((job) => (
            <JobThread key={job.engagement.id} job={job} {...card} />
          ))}
        </div>
      )}
    </details>
  );
}
