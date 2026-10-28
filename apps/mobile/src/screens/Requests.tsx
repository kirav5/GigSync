import type { GigDevice } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { C } from "../ui/cls.js";
import type { GigView } from "../useGig.js";
import { JobThread } from "./JobThread.js";

interface Props {
  isWorker: boolean;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  lang: Lang;
}

/** Every job this phone is in, newest first: requests to a worker, or a consumer's asks. */
export function Requests({ isWorker, view, device, run, lang }: Props) {
  const jobs = [...view.jobs].reverse();
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{isWorker ? "Requests" : "My jobs"}</span>
        <h1 className={C.headline}>
          {isWorker ? "Jobs that found you." : "Your asks."}{" "}
          <span className={C.soft}>Your agent talks; you decide.</span>
        </h1>
        {view.syncedAt && <span className={C.faint}>Checked {view.syncedAt.toLocaleTimeString()}</span>}
      </div>
      {jobs.length === 0 && (
        <div className={C.empty}>
          {isWorker ? "No requests yet. Publish your card to be found." : "Nothing asked yet. Find someone first."}
        </div>
      )}
      {jobs.map((job) => (
        <JobThread key={job.engagement.id} job={job} view={view} device={device} run={run} lang={lang} />
      ))}
    </>
  );
}
