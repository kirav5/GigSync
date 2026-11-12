import type { GigDevice, JobRecord } from "@gigsync/core";
import { type Payment, PaymentMethod } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";
import { money } from "../ui/places.js";
import { SpeakButton } from "../ui/SpeakButton.js";
import type { GigView } from "../useGig.js";
import { K } from "./kit.js";
import { moneyWhen, payerName } from "./payer.js";
import { QrCard } from "./QrCard.js";
import { type Run, useStep } from "./useStep.js";

/** Between the parts of the line under the amount: how, when, and the UPI reference. */
const DOT = " · ";

interface Props {
  job: JobRecord;
  view: GigView;
  payment: Payment;
  device: GigDevice;
  run: Run;
  onAddPayee: () => void;
}

/**
 * The customer says they paid: what they said, with how, when and the UPI reference their phone sent, so the worker
 * can find it in their bank; then the worker confirms it, or says it did not come. The worker's word, not the app's,
 * is what records it: a confirmed payment goes into the work record, which the server keeps too (ADR 0054 §5). Not
 * received is a plain answer, not an alarm: the worker can ask again after it.
 */
export function ConfirmPaid({ job, view, payment, device, run, onAddPayee }: Props) {
  const { lang, t, time, date } = useI18n();
  const { step, error } = useStep(run);
  const price = money(payment.amount_paise);
  const name = payerName(job, view, t);
  const how = [
    payment.method === PaymentMethod.enum.upi ? t("money.by_upi") : undefined,
    payment.paid_at ? moneyWhen({ time, date }, payment.paid_at) : undefined,
    payment.utr ? t("payrow.ref", { utr: payment.utr }) : undefined,
  ].filter(Boolean);
  return (
    <fieldset className="worker-pay" aria-label={t("a11y.confirm_payment")}>
      <div className={K.hero}>
        <div className="row-between">
          <span className={K.fine}>{t("money.says_paid", { name })}</span>
          <SpeakButton lang={lang} text={t("home.say_paid", { name, price })} />
        </div>
        <b className={K.amount}>{price}</b>
        {how.length > 0 && <span className={K.fine}>{how.join(DOT)}</span>}
      </div>
      <button type={C.button} className={K.big} onClick={() => step(() => device.confirmPayment(payment.id))}>
        <Icon name="tick" size={20} />
        {t("job.money_received")}
      </button>
      <button type={C.button} className={C.secondary} onClick={() => step(() => device.disputePayment(payment.id))}>
        {t("job.not_received")}
      </button>
      {error && <p className={C.error}>{error}</p>}
      <QrCard device={device} payment={payment} name={name} onAddPayee={onAddPayee} />
      <p className={K.fine}>{t("money.saved_note")}</p>
    </fieldset>
  );
}
