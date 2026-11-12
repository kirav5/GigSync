import type { JobRecord } from "@gigsync/core";
import { useState } from "react";
import { C } from "../../ui/cls.js";
import type { JobActionProps } from "../JobActions.js";
import { JobThread } from "../JobThread.js";
import "../jobs.css";

/** What every job card in a list needs, besides the job. */
export type CardProps = Omit<JobActionProps, "job">;
type ListProps = CardProps & { jobs: readonly JobRecord[] };

/** Job cards one under the other, each with its own actions. */
export function JobList({ jobs, ...card }: ListProps) {
  return jobs.map((job) => <JobThread key={job.engagement.id} job={job} {...card} />);
}

/**
 * Jobs folded under `summary`. The cards are built only once it is opened: each one translates the other side's
 * words on this phone, and history only grows.
 */
export function JobFold({ summary, jobs, ...card }: ListProps & { summary: string }) {
  const [open, setOpen] = useState(false);
  if (jobs.length === 0) return null;
  return (
    <details className="job-fold" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{summary}</summary>
      {open && (
        <div className={C.stack}>
          <JobList jobs={jobs} {...card} />
        </div>
      )}
    </details>
  );
}
