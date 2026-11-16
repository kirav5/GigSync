import {
  askableNow,
  bothSigned,
  canAskAdvance,
  canRequestPayment,
  type GigDevice,
  type JobRecord,
  SETTLE_CAP_DAYS,
  UNDER_WAY,
  workStarted,
} from "@gigsync/core";
import { EngagementStatus, type Payment, PROBLEM_HOLD_DAYS } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { AskAdvance } from "../../payments/AskAdvance.js";
import type { Run, Step } from "../../payments/useStep.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { Sheet } from "../../ui/Sheet.js";
import { StepTimes } from "../JobProgress.js";
import { CancelJob } from "./CancelJob.js";
import { J, shortHash } from "./look.js";
import { NoteBox } from "./NoteBox.js";

const S = EngagementStatus.enum;
/** Once both have signed, a worker may leave a note for the customer. */
const SIGNED: ReadonlySet<EngagementStatus> = new Set([S.agreed, S.in_progress, S.delivered]);

interface Props {
  job: JobRecord;
  device: GigDevice;
  step: Step;
  /** Runs a money move, holding the card's other moves meanwhile. */
  run: Run;
  /** Sends a note; notes queue by themselves, so they hold nothing. */
  onNote: (text: string) => Promise<unknown>;
  them: string;
  isWorker: boolean;
  payments: readonly Payment[];
  onAddPayee: (() => void) | undefined;
}

/**
 * "⋯ More" under a signed job's one button, and the sheet it opens: everything the day rarely needs, one tap away
 * instead of on the card (a note, an advance, cancel or stop, and the record's times and signature). Each says its cost
 * in one line, as Urban Company's cancel does. Nothing at all before both signed.
 */
export function MoreSheet(props: Props) {
  const { job } = props;
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!bothSigned(job)) return null;
  return (
    <>
      <button type={C.button} className={`${J.ghost} more-btn`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon name="menu" />
        {t("job.more")}
      </button>
      {open && <MoreBody {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function MoreBody({
  job,
  device,
  step,
  run,
  onNote,
  them,
  isWorker,
  payments,
  onAddPayee,
  onClose,
}: Props & { onClose: () => void }) {
  const { t } = useI18n();
  const id = job.engagement.id;
  const status = job.engagement.status;
  const started = workStarted(job);
  const advance =
    isWorker && onAddPayee && canRequestPayment(job.engagement) && !askableNow(job) && canAskAdvance(job, payments);
  return (
    <Sheet title={t("job.more")} line={them} onClose={onClose}>
      {isWorker && SIGNED.has(status) && <NoteBox them={them} onSend={onNote} />}
      {advance && <AskAdvance job={job} device={device} run={run} onAddPayee={onAddPayee} />}
      {UNDER_WAY.has(status) && (
        <CancelJob
          started={started}
          them={them}
          note={started ? undefined : t("jobcard.cancel_note")}
          onCancel={(stop) => {
            onClose();
            step(() => device.cancelJob(id, stop));
          }}
        />
      )}
      <Details job={job} payments={payments} />
    </Sheet>
  );
}

/** The record's small print: when each step happened, both signatures' hash, and when the contact leaves the phone. */
function Details({ job, payments }: { job: JobRecord; payments: readonly Payment[] }) {
  const { t } = useI18n();
  return (
    <div className="more-details">
      <p className={J.label}>{t("job.times")}</p>
      <StepTimes job={job} payments={payments} />
      {bothSigned(job) && (
        <p className={J.fine}>{t("jobcard.both_signed", { hash: shortHash(job.mine.terms_hash) })}</p>
      )}
      {job.contact && (
        <p className={J.fine}>{t("jobcard.contact_leaves", { days: SETTLE_CAP_DAYS, hold: PROBLEM_HOLD_DAYS })}</p>
      )}
    </div>
  );
}
