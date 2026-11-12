import {
  type GigDevice,
  type JobRecord,
  type MessageKey,
  nextWorkerStep,
  type WorkerStep,
  workStarted,
} from "@gigsync/core";
import { UpdateCode } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import type { Step } from "../../payments/useStep.js";
import { C } from "../../ui/cls.js";
import { Icon, type IconName } from "../../ui/Icon.js";
import { CancelJob } from "./CancelJob.js";
import { J } from "./look.js";

const U = UpdateCode.enum;
/** The worker's next move as its button says it: on the way, then arrived and started, then done. */
const STEP_LABEL: Readonly<Record<WorkerStep, MessageKey>> = {
  [U.on_my_way]: "update.on_my_way",
  [U.started]: "job.start_work",
  [U.done]: "job.mark_done",
};
const STEP_ICON: Readonly<Record<WorkerStep, IconName>> = {
  [U.on_my_way]: "arrow",
  [U.started]: "pin",
  [U.done]: "tick",
};

interface Props {
  job: JobRecord;
  device: GigDevice;
  step: Step;
  them: string;
  isWorker: boolean;
}

/**
 * A signed job on its day (W12, H10): for the worker, the one next step as the big button, and once on the way a
 * one-tap "Running late"; for either side, a quiet Cancel, or Stop with a reason once the work has started. Each tap
 * moves the same step line on the other phone.
 */
export function JobDay({ job, device, step, them, isWorker }: Props) {
  const { t } = useI18n();
  const id = job.engagement.id;
  const next = isWorker ? nextWorkerStep(job) : undefined;
  const started = workStarted(job);
  /** The worker's next step: a progress update, or the work handed over once it is done. */
  const moveOn = (to: WorkerStep) =>
    to === U.done ? device.deliver(id, { code: U.done }) : device.update(id, { code: to });
  return (
    <CancelJob
      started={started}
      them={them}
      note={started ? undefined : t("jobcard.cancel_note")}
      onCancel={(stop) => step(() => device.cancelJob(id, stop))}
    >
      {/* Keyed by step: the next step is a new button, so a tap meant for one never lands on the next. */}
      {next && (
        <button key={next} type={C.button} className={J.hero} onClick={() => step(() => moveOn(next))}>
          <Icon name={STEP_ICON[next]} />
          {t(STEP_LABEL[next])}
        </button>
      )}
      {/* On the way and not there yet: late is the one thing worth a tap; anything else goes in a note. */}
      {next === U.started && (
        <span>
          <button type={C.button} className={C.chip} onClick={() => step(() => device.update(id, { code: U.delayed }))}>
            <Icon name="clock" />
            {t("update.delayed")}
          </button>
        </span>
      )}
    </CancelJob>
  );
}
