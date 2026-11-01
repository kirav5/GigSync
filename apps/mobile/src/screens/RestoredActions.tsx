import type { GigDevice, JobRecord } from "@gigsync/core";
import { EngagementStatus, JobRecordStatus, Role } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";

const S = EngagementStatus.enum;
const R = JobRecordStatus.enum;
/** A restored job can still be ended while it is under way. */
const UNDER_WAY: ReadonlySet<EngagementStatus> = new Set([S.agreed, S.in_progress]);

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
  const [sure, setSure] = useState(false);
  if (!job.restored || !UNDER_WAY.has(job.engagement.status)) return null;
  const id = job.engagement.id;
  const isWorker = job.engagement.role === Role.enum.provider;
  const end = (to: typeof R.done | typeof R.cancelled) => void run(() => device.endRestored(id, to));
  return (
    <div className={C.stack}>
      <span className={C.faint}>{t("restored.why", { name: them })}</span>
      {sure ? (
        <fieldset className={C.actions} aria-label={t("restored.cancel_sure")}>
          <span>{t("restored.cancel_sure")}</span>
          <button type={C.button} className={C.danger} onClick={() => end(R.cancelled)}>
            {t("restored.cancel_yes")}
          </button>
          <button type={C.button} className={C.secondary} onClick={() => setSure(false)}>
            {t("restored.keep")}
          </button>
        </fieldset>
      ) : (
        <div className={C.actions}>
          <button type={C.button} className={C.secondary} onClick={() => end(R.done)}>
            {t(isWorker ? "job.mark_done" : "restored.work_done")}
          </button>
          <button type={C.button} className={C.quiet} onClick={() => setSure(true)}>
            {t("restored.cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
