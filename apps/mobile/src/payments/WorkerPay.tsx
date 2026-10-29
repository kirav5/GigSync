import {
  AskAgain,
  askAgain,
  canRequestPayment,
  type GigDevice,
  type JobRecord,
  log,
  type MessageKey,
  PayeeMissingError,
} from "@gigsync/core";
import { type Payment, PaymentMethod, PaymentStatus, Role } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";
import { SpeakButton } from "../ui/SpeakButton.js";
import type { GigView } from "../useGig.js";
import { NeedUpi, WorkerQr } from "./WorkerQr.js";
import "./money.css";

type Run = (work: () => Promise<unknown>) => Promise<unknown>;

interface Props {
  job: JobRecord;
  view: GigView;
  device: GigDevice;
  run: Run;
  /** Opens Profile when the worker has no UPI ID yet. */
  onAddPayee: () => void;
}

const S = PaymentStatus.enum;
const PAY = "worker-pay";

/** The ask button's words when the job was asked for before: after a dispute, or for a new month of monthly work. */
const ASK_AGAIN: Readonly<Record<AskAgain, MessageKey>> = {
  [AskAgain.dispute]: "money.ask_again",
  [AskAgain.month]: "money.ask_month",
};

/**
 * The worker's money actions inside a signed job, at most one state at a time: confirm money the customer says they
 * sent; or, with a request open, show the QR, take cash, or say whether it arrived; or else ask to be paid. Asking again
 * is offered only after a dispute, or for monthly work a month on: a paid one-off job offers nothing.
 */
export function WorkerPay({ job, view, device, run, onAddPayee }: Props) {
  if (job.engagement.role !== Role.enum.provider) return null;
  const payments = view.payments.filter((p) => p.engagement === job.engagement.id);
  const claimed = payments.find((p) => p.status === S.paid);
  if (claimed) return <ConfirmPaid job={job} view={view} payment={claimed} device={device} run={run} />;
  const open = payments.find((p) => p.status === S.requested);
  if (open) return <OpenPayment payment={open} device={device} run={run} onAddPayee={onAddPayee} />;
  if (!canRequestPayment(job.engagement)) return null;
  const again = payments.length === 0 ? undefined : askAgain(job, payments, new Date());
  if (payments.length > 0 && !again) return null;
  const ask: MessageKey = again ? ASK_AGAIN[again] : "job.ask_payment";
  return <AskPayment job={job} ask={ask} device={device} run={run} onAddPayee={onAddPayee} />;
}

/** Runs one money step through the sync queue, and says what went wrong: no UPI ID saved, or anything else. */
function useStep(run: Run) {
  const { t } = useI18n();
  const [error, setError] = useState<string>();
  const [missing, setMissing] = useState(false);
  function step(work: () => Promise<unknown>) {
    setError(undefined);
    run(work).catch((err: unknown) => {
      if (err instanceof PayeeMissingError) return setMissing(true);
      log.warn("payment step failed", { error: err instanceof Error ? err.message : String(err) });
      setError(t("error.generic"));
    });
  }
  return { step, error, missing };
}

/** (a) Nothing open: ask for the signed price, or record that the customer already paid in cash. */
function AskPayment({
  job,
  ask,
  device,
  run,
  onAddPayee,
}: Pick<Props, "job" | "device" | "run" | "onAddPayee"> & { ask: MessageKey }) {
  const { t } = useI18n();
  const { step, error, missing } = useStep(run);
  const [cash, setCash] = useState(false);
  const id = job.engagement.id;
  const price = job.mine?.terms.price_paise;
  return (
    <div className={PAY}>
      {cash && price !== undefined ? (
        <CashConfirm
          price={price}
          onAnswer={(yes) => {
            setCash(false);
            if (yes) step(() => device.recordCash(id));
          }}
        />
      ) : (
        <div className={C.actions}>
          <button
            type={C.button}
            className={C.accent}
            onClick={() => step(() => device.requestPayment(id, job.request.need))}
          >
            {t(ask)}
          </button>
          {price !== undefined && (
            <button type={C.button} className={C.secondary} onClick={() => setCash(true)}>
              {t("getpaid.cash")}
            </button>
          )}
        </div>
      )}
      {missing && <NeedUpi onAddPayee={onAddPayee} />}
      {error && <p className={C.error}>{error}</p>}
    </div>
  );
}

/** (b) Asked and waiting: the worker's QR for a customer in front of them, cash, or whether the money arrived. */
function OpenPayment({
  payment,
  device,
  run,
  onAddPayee,
}: Pick<Props, "device" | "run" | "onAddPayee"> & { payment: Payment }) {
  const { t } = useI18n();
  const { step, error } = useStep(run);
  const [qr, setQr] = useState(false);
  const [cash, setCash] = useState(false);
  return (
    <div className={PAY}>
      {payment.method === PaymentMethod.enum.upi && (
        <div className={C.actions}>
          <button type={C.button} className={C.secondary} aria-expanded={qr} onClick={() => setQr(!qr)}>
            {t(qr ? "money.hide_qr" : "money.show_qr")}
          </button>
        </div>
      )}
      {qr && <WorkerQr device={device} payment={payment} onAddPayee={onAddPayee} />}
      {cash ? (
        <CashConfirm
          price={payment.amount_paise}
          onAnswer={(yes) => {
            setCash(false);
            if (yes) step(() => device.recordCash(payment.engagement));
          }}
        />
      ) : (
        <div className={C.actions}>
          <button type={C.button} className={C.accent} onClick={() => step(() => device.confirmPayment(payment.id))}>
            {t("job.money_received")}
          </button>
          <button type={C.button} className={C.secondary} onClick={() => setCash(true)}>
            {t("getpaid.cash")}
          </button>
          <button type={C.button} className={C.danger} onClick={() => step(() => device.disputePayment(payment.id))}>
            {t("job.not_received")}
          </button>
        </div>
      )}
      {error && <p className={C.error}>{error}</p>}
    </div>
  );
}

/** (c) The customer says they paid: the worker checks their bank and confirms, or says it did not come. */
function ConfirmPaid({
  job,
  view,
  payment,
  device,
  run,
}: Pick<Props, "job" | "view" | "device" | "run"> & { payment: Payment }) {
  const { lang, t } = useI18n();
  const { step, error } = useStep(run);
  const price = money(payment.amount_paise);
  const name = job.contact?.name || view.names[job.engagement.counterpart] || t("job.customer");
  return (
    <fieldset className={C.stack} aria-label={t("a11y.confirm_payment")}>
      <div className={C.row}>
        <SpeakButton lang={lang} text={t("home.say_paid", { name, price })} />
        <span className={C.muted}>{t("job.customer_paid", { price })}</span>
      </div>
      {payment.utr && <span className={C.faint}>{t("payrow.ref", { utr: payment.utr })}</span>}
      <div className={C.actions}>
        <button type={C.button} className={C.accent} onClick={() => step(() => device.confirmPayment(payment.id))}>
          {t("job.money_received")}
        </button>
        <button type={C.button} className={C.danger} onClick={() => step(() => device.disputePayment(payment.id))}>
          {t("job.not_received")}
        </button>
      </div>
      {error && <p className={C.error}>{error}</p>}
    </fieldset>
  );
}

/** One more tap before cash is recorded: it is confirmed on both phones at once and cannot be taken back. */
function CashConfirm({ price, onAnswer }: { price: number; onAnswer: (yes: boolean) => void }) {
  const { t } = useI18n();
  return (
    <div className={C.stack}>
      <span>{t("money.cash_confirm", { price: money(price) })}</span>
      <div className={C.actions}>
        <button type={C.button} className={C.accent} onClick={() => onAnswer(true)}>
          {t("flag.yes")}
        </button>
        <button type={C.button} className={C.secondary} onClick={() => onAnswer(false)}>
          {t("flag.no")}
        </button>
      </div>
    </div>
  );
}
