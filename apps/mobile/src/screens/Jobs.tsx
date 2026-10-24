import type { Ports } from "@gigsync/core";
import type { Engagement } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { type JobMove, moveJob, recordJob } from "../payments/store.js";
import type { GigData } from "../state.js";
import { C } from "../ui/cls.js";
import { JobCard } from "./JobCard.js";

interface Props {
  ports: Ports;
  data: GigData;
  changed: () => Promise<void>;
  pay: (job: Engagement) => void;
}

/** Her jobs: record one agreed in person, move it along, and get paid for it. */
export function Jobs({ ports, data, changed, pay }: Props) {
  const [error, setError] = useState<string>();

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = new FormData(form);
    const consumer = String(values.get("consumer") ?? "").trim();
    const work = String(values.get("work") ?? "").trim();
    if (!consumer || !work) return setError("Enter the customer's name and the work.");
    await recordJob(ports.storage, { consumer, work }, ports.clock.now());
    form.reset();
    setError(undefined);
    await changed();
  }

  async function move(job: Engagement, m: JobMove) {
    await moveJob(ports.storage, job, m, ports.clock.now());
    await changed();
  }

  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>Jobs</span>
        <h1 className={C.headline}>
          Agree first. <span className={C.soft}>Keep the record.</span>
        </h1>
      </div>

      <form className={C.card} onSubmit={(e) => void add(e)}>
        <span className={C.label}>Record a job you agreed</span>
        <input className={C.field} name="consumer" placeholder="Customer's name" autoComplete={C.off} />
        <input className={C.field} name="work" placeholder="Work, e.g. house cleaning Mon–Fri" autoComplete={C.off} />
        {error && <p className={C.error}>{error}</p>}
        <div>
          <button type="submit" className={C.btn}>
            Add job
          </button>
        </div>
        <span className={C.faint}>
          Soon your agent agrees jobs with the customer's agent directly; for the pilot you record them here.
        </span>
      </form>

      {data.ready && data.jobs.length === 0 && <div className={C.empty}>No jobs yet. Add the first one above.</div>}
      {data.jobs.map((j) => (
        <JobCard key={j.id} job={j} payments={data.payments} onMove={(job, m) => void move(job, m)} onPay={pay} />
      ))}
    </>
  );
}
