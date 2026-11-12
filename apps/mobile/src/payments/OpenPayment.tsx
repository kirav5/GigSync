import type { GigDevice, JobRecord } from "@gigsync/core";
import { type Payment, PaymentMethod } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";
import { SpeakButton } from "../ui/SpeakButton.js";
import type { GigView } from "../useGig.js";
import { Confirm } from "./Confirm.js";
import { K } from "./kit.js";
import { moneyWhen, payerName } from "./payer.js";
import { QrCard } from "./QrCard.js";
import { type Run, useStep } from "./useStep.js";

/** The open request's last resort: a link, not a button, so nobody marks money received that has not come. */
const QUIET_LINK = `${C.linkBtn} pay-quiet`;
/** What the worker is being asked to confirm before it is recorded on both phones. */
const Settle = { cash: "cash", bank: "bank" } as const;
type Settle = (typeof Settle)[keyof typeof Settle];

interface Props {
  job: JobRecord;
  view: GigView;
  payment: Payment;
  device: GigDevice;
  run: Run;
  onAddPayee: () => void;
}

/**
 * Asked and waiting for the customer: whom the worker waits on and since when, the worker's QR for a customer in front
 * of them, or cash. Nobody has said they paid, so there is nothing to dispute yet; money paid from another UPI app
 * without "I paid" can still be marked received, through a quiet link and one more question.
 */
export function OpenPayment({ job, view, payment, device, run, onAddPayee }: Props) {
  const { lang, t, time, date } = useI18n();
  const { step, error } = useStep(run);
  const [settle, setSettle] = useState<Settle>();
  const price = money(payment.amount_paise);
  const name = payerName(job, view, t);
  const waiting = t("money.waiting", { name, price });
  function answer(yes: boolean) {
    setSettle(undefined);
    if (!yes) return;
    if (settle === Settle.cash) step(() => device.recordCash(payment.engagement));
    else step(() => device.confirmPayment(payment.id));
  }
  return (
    <div className="worker-pay">
      <div className={`${C.card} pay-waiting`}>
        <div className={C.row}>
          <SpeakButton lang={lang} text={waiting} />
          <span>{waiting}</span>
        </div>
        {payment.requested_at && (
          <span className={K.fine}>
            {t("money.asked_at", { time: moneyWhen({ time, date }, payment.requested_at) })}
          </span>
        )}
      </div>
      {payment.method === PaymentMethod.enum.upi && (
        <QrCard device={device} payment={payment} name={name} onAddPayee={onAddPayee} />
      )}
      {settle ? (
        <Confirm
          ask={t(settle === Settle.cash ? "money.cash_confirm" : "money.bank_confirm", { price })}
          onAnswer={answer}
        />
      ) : (
        <>
          <button type={C.button} className={C.secondary} onClick={() => setSettle(Settle.cash)}>
            {t("getpaid.cash")}
          </button>
          <button type={C.button} className={QUIET_LINK} onClick={() => setSettle(Settle.bank)}>
            {t("money.already_in_bank")}
          </button>
        </>
      )}
      {error && <p className={C.error}>{error}</p>}
    </div>
  );
}
