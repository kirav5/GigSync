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
import { type I18n, useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { errorKey } from "../ui/errorKey.js";
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
  /** Opens About me when the worker has no UPI ID yet. */
  onAddPayee: () => void;
}

const S = PaymentStatus.enum;
const PAY = "worker-pay";
/** The open request's last resort: a link, not a button, so nobody marks money received that has not come. */
const QUIET_LINK = `${C.linkBtn} pay-quiet`;
/** What the worker is being asked to confirm before it is recorded on both phones. */
const Settle = { cash: "cash", bank: "bank" } as const;
type Settle = (typeof Settle)[keyof typeof Settle];

/** The ask button's words when the job was asked for before: after a dispute, or for a new month of monthly work. */
const ASK_AGAIN: Readonly<Record<AskAgain, MessageKey>> = {
  [AskAgain.dispute]: "money.ask_again",
  [AskAgain.month]: "money.ask_month",
};

/**
 * The worker's money actions inside a signed job, at most one state at a time: confirm money the customer says they
 * sent; or, with a request open, wait for the customer, show the QR, or take cash; or else ask to be paid. Asking again
 * is offered only after a dispute, or for monthly work a month on: a paid one-off job offers nothing.
 */
export function WorkerPay({ job, view, device, run, onAddPayee }: Props) {
  if (job.engagement.role !== Role.enum.provider) return null;
  const payments = view.payments.filter((p) => p.engagement === job.engagement.id);
  const claimed = payments.find((p) => p.status === S.paid);
  if (claimed) return <ConfirmPaid job={job} view={view} payment={claimed} device={device} run={run} />;
  const open = payments.find((p) => p.status === S.requested);
  if (open)
    return <OpenPayment job={job} view={view} payment={open} device={device} run={run} onAddPayee={onAddPayee} />;
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
      setError(t(errorKey(err)));
    });
  }
  return { step, error, missing };
}

/** The customer as the worker knows them: their contact card's name, the board's, or "the customer". */
function payerName(job: JobRecord, view: GigView, t: I18n["t"]): string {
  return job.contact?.name || view.names[job.engagement.counterpart] || t("job.customer");
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

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
        <Confirm
          ask={t("money.cash_confirm", { price: money(price) })}
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

/**
 * (b) Asked and waiting for the customer: the worker's QR for a customer in front of them, or cash. Nobody has said
 * they paid, so there is nothing to dispute yet; money paid from another UPI app without "I paid" can still be marked
 * received, through a quiet link and one more question.
 */
function OpenPayment({
  job,
  view,
  payment,
  device,
  run,
  onAddPayee,
}: Pick<Props, "job" | "view" | "device" | "run" | "onAddPayee"> & { payment: Payment }) {
  const { lang, t, time, date } = useI18n();
  const { step, error } = useStep(run);
  const [qr, setQr] = useState(false);
  const [settle, setSettle] = useState<Settle>();
  const price = money(payment.amount_paise);
  const waiting = t("money.waiting", { name: payerName(job, view, t), price });
  const asked = payment.requested_at ? new Date(payment.requested_at) : undefined;
  const askedAt = asked && (sameDay(asked, new Date()) ? time(asked) : `${date(asked)} ${time(asked)}`);
  function answer(yes: boolean) {
    setSettle(undefined);
    if (!yes) return;
    if (settle === Settle.cash) step(() => device.recordCash(payment.engagement));
    else step(() => device.confirmPayment(payment.id));
  }
  return (
    <div className={PAY}>
      <div className={C.row}>
        <SpeakButton lang={lang} text={waiting} />
        <span className={C.muted}>{waiting}</span>
      </div>
      {askedAt && <span className={C.faint}>{t("money.asked_at", { time: askedAt })}</span>}
      {qr && <WorkerQr device={device} payment={payment} onAddPayee={onAddPayee} />}
      {settle ? (
        <Confirm
          ask={t(settle === Settle.cash ? "money.cash_confirm" : "money.bank_confirm", { price })}
          onAnswer={answer}
        />
      ) : (
        <>
          <div className={C.actions}>
            {payment.method === PaymentMethod.enum.upi && (
              <button type={C.button} className={C.accent} aria-expanded={qr} onClick={() => setQr(!qr)}>
                {t(qr ? "money.hide_qr" : "money.show_qr")}
              </button>
            )}
            <button type={C.button} className={C.secondary} onClick={() => setSettle(Settle.cash)}>
              {t("getpaid.cash")}
            </button>
          </div>
          <button type={C.button} className={QUIET_LINK} onClick={() => setSettle(Settle.bank)}>
            {t("money.already_in_bank")}
          </button>
        </>
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
  const name = payerName(job, view, t);
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

/** One more tap before money is recorded as received: it is confirmed on both phones at once and cannot be taken back. */
function Confirm({ ask, onAnswer }: { ask: string; onAnswer: (yes: boolean) => void }) {
  const { t } = useI18n();
  return (
    <div className={C.stack}>
      <span>{ask}</span>
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
