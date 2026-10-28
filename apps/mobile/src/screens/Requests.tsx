import type { GigDevice } from "@gigsync/core";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import type { GigView } from "../useGig.js";
import { JobThread } from "./JobThread.js";

interface Props {
  isWorker: boolean;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
}

/** Every job this phone is in, newest first: requests to a worker, or a consumer's asks. */
export function Requests({ isWorker, view, device, run }: Props) {
  const { t, time } = useI18n();
  const jobs = [...view.jobs].reverse();
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t(isWorker ? "nav.requests" : "nav.my_jobs")}</span>
        <h1 className={C.headline}>
          {t(isWorker ? "requests.headline_worker" : "requests.headline_consumer")}{" "}
          <span className={C.soft}>{t("requests.soft")}</span>
        </h1>
        {view.syncedAt && <span className={C.faint}>{t("requests.checked", { time: time(view.syncedAt) })}</span>}
      </div>
      {jobs.length === 0 && (
        <div className={C.empty}>{t(isWorker ? "requests.empty_worker" : "requests.empty_consumer")}</div>
      )}
      {jobs.map((job) => (
        <JobThread key={job.engagement.id} job={job} view={view} device={device} run={run} />
      ))}
    </>
  );
}
