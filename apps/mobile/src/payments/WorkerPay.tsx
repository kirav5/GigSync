import {
  agreedPrice,
  askAgain,
  askableNow,
  balanceDue,
  canAskAdvance,
  canRequestPayment,
  type GigDevice,
  type JobRecord,
  recurs,
} from "@gigsync/core";
import { PaymentStatus, Role } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import type { GigView } from "../useGig.js";
import { AskAdvance } from "./AskAdvance.js";
import { AskPayment } from "./AskPayment.js";
import { ConfirmPaid } from "./ConfirmPaid.js";
import { OpenPayment } from "./OpenPayment.js";
import { payerName } from "./payer.js";
import type { Run } from "./useStep.js";
import "./money.css";

interface Props {
  job: JobRecord;
  view: GigView;
  device: GigDevice;
  run: Run;
  /** Opens About me when the worker has no UPI ID yet. */
  onAddPayee: () => void;
}

const S = PaymentStatus.enum;

/**
 * The worker's money actions inside a signed job, at most one state at a time: confirm money the customer says they
 * sent; or, with a request open, wait for the customer, show the QR, or take cash; or else ask to be paid. One-off work
 * is asked for once it is done, with at most an advance before that, and what is left after it (ADR 0054). Asking again
 * is offered only after a dispute, or for monthly work a month on: a paid one-off job offers nothing.
 */
export function WorkerPay({ job, view, device, run, onAddPayee }: Props) {
  const { t } = useI18n();
  if (job.engagement.role !== Role.enum.provider) return null;
  const payments = view.payments.filter((p) => p.engagement === job.engagement.id);
  const open = { job, view, device, run, onAddPayee };
  const claimed = payments.find((p) => p.status === S.paid);
  if (claimed) return <ConfirmPaid {...open} payment={claimed} />;
  const asked = payments.find((p) => p.status === S.requested);
  if (asked) return <OpenPayment {...open} payment={asked} />;
  if (!canRequestPayment(job.engagement)) return null;
  if (!askableNow(job))
    return canAskAdvance(job, payments) ? (
      <AskAdvance job={job} device={device} run={run} onAddPayee={onAddPayee} />
    ) : null;
  const again = payments.length === 0 ? undefined : askAgain(job, payments, new Date());
  const repeats = recurs(job.request);
  const due = repeats ? agreedPrice(job) : balanceDue(job, payments);
  if (due === 0 || (repeats && payments.length > 0 && !again)) return null;
  return (
    <AskPayment
      job={job}
      again={again}
      due={due}
      name={payerName(job, view, t)}
      device={device}
      run={run}
      onAddPayee={onAddPayee}
    />
  );
}
