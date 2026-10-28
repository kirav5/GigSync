import type { Ports } from "@gigsync/core";
import type { Engagement } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { useI18n } from "../i18n.js";
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

/** Their jobs: record one agreed in person, move it along, and get paid for it. */
export function Jobs({ ports, data, changed, pay }: Props) {
  const { t } = useI18n();
  const [error, setError] = useState<string>();

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = new FormData(form);
    const consumer = String(values.get("consumer") ?? "").trim();
    const work = String(values.get("work") ?? "").trim();
    if (!consumer || !work) return setError(t("jobs.err"));
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
        <span className={C.labelSq}>{t("stat.jobs")}</span>
        <h1 className={C.headline}>
          {t("jobs.headline")} <span className={C.soft}>{t("jobs.soft")}</span>
        </h1>
      </div>

      <form className={C.card} onSubmit={(e) => void add(e)}>
        <span className={C.label}>{t("today.tile_jobs")}</span>
        <input className={C.field} name="consumer" placeholder={t("jobs.customer")} autoComplete={C.off} />
        <input className={C.field} name="work" placeholder={t("jobs.work")} autoComplete={C.off} />
        {error && <p className={C.error}>{error}</p>}
        <div>
          <button type="submit" className={C.btn}>
            {t("jobs.add")}
          </button>
        </div>
        <span className={C.faint}>{t("jobs.soon")}</span>
      </form>

      {data.ready && data.jobs.length === 0 && <div className={C.empty}>{t("jobs.empty")}</div>}
      {data.jobs.map((j) => (
        <JobCard key={j.id} job={j} payments={data.payments} onMove={(job, m) => void move(job, m)} onPay={pay} />
      ))}
    </>
  );
}
