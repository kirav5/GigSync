import { asciiDigits, type GigDevice, type JobRecord, Step as JobStep, jobProgress } from "@gigsync/core";
import type { Payment } from "@gigsync/protocol";
import { type FormEvent, useEffect, useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";
import { ListCard, ListRow } from "../ui/ListRow.js";
import { money } from "../ui/places.js";
import { Working } from "../ui/Working.js";
import { K } from "./kit.js";
import { moneyWhen, payeeIn } from "./payer.js";
import { qrDataUrl } from "./qr.js";
import { UpiButtons } from "./UpiButtons.js";
import type { Step } from "./useStep.js";
import "./money.css";

interface Props {
  payment: Payment;
  device: GigDevice;
  step: Step;
  /** The job, for when the work was done; without it the card says when the money was asked for. */
  job?: JobRecord | undefined;
  /** The worker as the job card names them; without it, the name their UPI link carries. */
  them?: string | undefined;
}

/** The worker's sealed request as this phone reads it: the UPI link and the same link drawn as a QR. */
interface Request {
  link: string;
  qr: string;
}

/**
 * The household pays in their own UPI app; GigSync only opens it with the worker's ID and the amount filled in, and
 * records the "I've paid" and the reference they may paste back. Nothing passes through GigSync, so the card says so
 * beside the UPI ID it pays. A phone cannot scan its own screen, so here the button is the way; the QR (ADR 0011's main
 * path, for paying from another phone) and the reference (the proof either side can match in a bank statement) wait
 * one tap away in a fold. Cash is no button here: only the worker can record cash (payments/book.ts), so a line says
 * they do. When the link cannot be built (this phone never got the worker's sealed payment request) it says so instead
 * of a dead QR.
 */
export function PayBox({ payment, device, step, job, them }: Props) {
  const { t } = useI18n();
  const [request, setRequest] = useState<Request>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false);
    void (async () => {
      try {
        const link = await device.upiLink(payment.id);
        const qr = await qrDataUrl(link);
        if (live) setRequest({ link, qr });
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [device, payment.id]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const utr = asciiDigits(String(new FormData(e.currentTarget).get("utr") ?? "").trim());
    step(() => device.markPaid(payment.id, utr || undefined));
  }
  const payee = request && payeeIn(request.link);
  const name = them || payee?.name || t("job.worker");
  return (
    <form className="pay-box" onSubmit={submit} aria-label={t("a11y.pay")}>
      <PayHero payment={payment} job={job} name={name} />
      {failed && <p className={C.error}>{t("error.generic")}</p>}
      <Working on={!request && !failed} />
      {payee && (
        <ListCard>
          <ListRow
            icon="rupee"
            title={t("money.pay_to", { vpa: payee.vpa })}
            sub={t("money.holds_nothing", { name })}
          />
        </ListCard>
      )}
      {request && (
        <>
          <UpiButtons link={request.link} />
          <p className={K.fine}>{t("money.upi_opens", { name, paid: t("job.paid") })}</p>
        </>
      )}
      <button type={C.submit} className={`${C.btn} wide`}>
        <Icon name="tick" size={20} />
        {t("job.paid")}
      </button>
      <p className={K.fine}>{t("money.cash_hint", { name })}</p>
      <details className="more pay-other">
        <summary>{t("money.other_way")}</summary>
        <div className={C.stack}>
          {request && <img src={request.qr} alt={t("a11y.qr")} width={160} height={160} />}
          <input
            className={C.field}
            name="utr"
            aria-label={t("a11y.utr")}
            placeholder={t("job.utr_placeholder")}
            inputMode="numeric"
          />
          <p className={K.fine}>{t("money.utr_why", { name })}</p>
        </div>
      </details>
    </form>
  );
}

/**
 * Who asks for how much, and what for: an advance says so; otherwise when the work was done, as the job's own steps
 * have it, or when the money was asked for.
 */
function PayHero({ payment, job, name }: { payment: Payment; job: JobRecord | undefined; name: string }) {
  const { t, time, date } = useI18n();
  const price = money(payment.amount_paise);
  const doneAt = job && jobProgress(job, [])?.find((s) => s.step === JobStep.done && s.reached)?.at;
  const when = payment.advance
    ? t("job.pay_advance", { price })
    : doneAt
      ? t("money.done_at", { time: moneyWhen({ time, date }, doneAt) })
      : payment.requested_at && t("money.asked_at", { time: moneyWhen({ time, date }, payment.requested_at) });
  return (
    <div className={K.hero}>
      <span className={K.fine}>{t("money.asks_for", { name })}</span>
      <b className={K.amount}>{price}</b>
      {when && <span className={K.fine}>{when}</span>}
    </div>
  );
}
