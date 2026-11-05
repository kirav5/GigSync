import { type GigDevice, type JobRecord, UNDER_WAY } from "@gigsync/core";
import { JobRecordStatus, Role } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import { useStep } from "../payments/useStep.js";
import { BusyGroup } from "../ui/BusyGroup.js";
import { C } from "../ui/cls.js";
import { useBusy } from "../ui/useBusy.js";
import { CancelJob } from "./job/CancelJob.js";

const R = JobRecordStatus.enum;

/**
 * The actions on a job this phone rebuilt from the owner's GigSync record. Its messages cannot go on (they never
 * reached the server), so the job ends through the record instead: marked done, or cancelled after a second tap. The
 * other side's phone follows the record within a minute.
 */
export function RestoredActions(props: {
  job: JobRecord;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  them: string;
}) {
  const { job, device, run, them } = props;
  const { t } = useI18n();
  const { busy, guard } = useBusy();
  const { step, error } = useStep((work) => guard(() => run(work)));
  if (!job.restored || !UNDER_WAY.has(job.engagement.status)) return null;
  const id = job.engagement.id;
  const isWorker = job.engagement.role === Role.enum.provider;
  const end = (to: typeof R.done | typeof R.cancelled) => step(() => device.endRestored(id, to));
  return (
    <div className={C.stack}>
      <span className={C.faint}>{t("restored.why", { name: them })}</span>
      <BusyGroup busy={busy}>
        <CancelJob onCancel={() => end(R.cancelled)}>
          <button type={C.button} className={C.secondary} onClick={() => end(R.done)}>
            {t(isWorker ? "job.mark_done" : "restored.work_done")}
          </button>
        </CancelJob>
      </BusyGroup>
      {error && <p className={C.error}>{error}</p>}
    </div>
  );
}
