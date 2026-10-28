import {
  asciiDigits,
  buildUpiUri,
  log,
  type MessageKey,
  type Params,
  type PaymentBook,
  rupees,
  summarize,
} from "@gigsync/core";
import {
  type Engagement,
  PAISE_PER_RUPEE,
  type Payment,
  PaymentMethod,
  PaymentStatus,
  UPI_MAX_PAISE,
  type UserId,
} from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { PaymentRow } from "./PaymentRow.js";
import { qrDataUrl } from "./qr.js";
import type { Payee } from "./store.js";

const S = PaymentStatus.enum;
/** Payments the worker can still settle: confirm as received, or dispute. */
export const OPEN_PAYMENT: ReadonlySet<Payment["status"]> = new Set([S.requested, S.paid]);

interface Props {
  book: PaymentBook;
  job: Engagement;
  payee: Payee;
  self: UserId;
  payments: readonly Payment[];
  changed: () => Promise<void>;
}

interface Showing {
  payment: Payment;
  uri: string;
  qr: string;
}

/** An amount the owner must fix, said in their language. */
class AmountError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly params: Params = {},
  ) {
    super(key);
  }
}

/** "450", "450.50" or "४५०" → paise, or an `AmountError` saying what is wrong. */
function toPaise(typed: string): number {
  const text = asciiDigits(typed.trim());
  const value = Number(text);
  if (!text || !Number.isFinite(value) || value <= 0) throw new AmountError("getpaid.err_amount");
  const paise = Math.round(value * PAISE_PER_RUPEE);
  if (paise > UPI_MAX_PAISE) throw new AmountError("getpaid.err_max", { max: `₹${rupees(UPI_MAX_PAISE)}` });
  return paise;
}

/** One job's payments: ask for an amount, show their UPI QR, then record what arrived. */
export function GetPaid({ book, job, payee, self, payments, changed }: Props) {
  const { t } = useI18n();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [utr, setUtr] = useState("");
  const [showing, setShowing] = useState<Showing>();
  const [error, setError] = useState<string>();
  const mine = payments.filter((p) => p.engagement === job.id);
  const sum = summarize(mine);

  async function run(step: () => Promise<void>) {
    setError(undefined);
    try {
      await step();
      await changed();
    } catch (e) {
      if (e instanceof AmountError) return setError(t(e.key, e.params));
      log.warn("payment step failed", { error: e instanceof Error ? e.message : String(e) });
      setError(t("error.generic"));
    }
  }

  function reset() {
    setShowing(undefined);
    setAmount("");
    setNote("");
    setUtr("");
  }

  const link = (p: Pick<Payment, "amount_paise" | "note" | "id">) =>
    buildUpiUri({ vpa: payee.vpa, name: payee.name, amountPaise: p.amount_paise, note: p.note, ref: p.id });

  async function show(payment: Payment) {
    const uri = link(payment);
    setShowing({ payment, uri, qr: await qrDataUrl(uri) });
    setUtr("");
  }

  const showQr = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const amountPaise = toPaise(amount);
      link({ amount_paise: amountPaise, note, id: job.id }); // validates before anything is recorded
      await show(await book.request({ engagement: job, payee: self, amountPaise, note }));
    });
  };

  const paidInCash = () =>
    run(async () => {
      const method = PaymentMethod.enum.cash;
      const payment = await book.request({ engagement: job, payee: self, amountPaise: toPaise(amount), note, method });
      await book.confirm(payment.id);
      reset();
    });

  const settle = (id: string, arrived: boolean, ref = "") =>
    run(async () => {
      if (arrived) {
        if (ref.trim()) await book.markPaid(id, asciiDigits(ref.trim()));
        await book.confirm(id);
      } else {
        await book.dispute(id);
      }
      reset();
    });

  return (
    <>
      {!showing && (
        <form className={C.card} onSubmit={showQr}>
          <label className={C.fieldLabel}>
            <span className={C.label}>{t("getpaid.amount")}</span>
            <input
              className={C.field}
              inputMode="decimal"
              placeholder={t("getpaid.amount_placeholder")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className={C.fieldLabel}>
            <span className={C.label}>{t("getpaid.note")}</span>
            <input
              className={C.field}
              placeholder={t("getpaid.optional")}
              maxLength={50}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {error && <p className={C.error}>{error}</p>}
          <div className={C.row}>
            <button type="submit" className={C.accent}>
              {t("getpaid.show_qr")}
            </button>
            <button type={C.button} className={C.secondary} onClick={() => void paidInCash()}>
              {t("getpaid.cash")}
            </button>
          </div>
        </form>
      )}

      {showing && (
        <div className={`${C.card} qr`}>
          <span className={C.labelSq}>{t("getpaid.scan")}</span>
          <img
            src={showing.qr}
            alt={t("getpaid.qr_alt", { price: `₹${rupees(showing.payment.amount_paise)}`, vpa: payee.vpa })}
          />
          <span className="amount">₹{rupees(showing.payment.amount_paise)}</span>
          <span className={C.muted}>{t("getpaid.to", { name: payee.name, vpa: payee.vpa })}</span>
          <span className={C.faint}>{t("getpaid.scan_about")}</span>
          <a className={C.secondary} href={showing.uri}>
            {t("getpaid.open_upi")}
          </a>
          <input
            className={C.field}
            inputMode="numeric"
            placeholder={t("getpaid.utr")}
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
          />
          {error && <p className={C.error}>{error}</p>}
          <div className={C.row}>
            <button type={C.button} className={C.accent} onClick={() => void settle(showing.payment.id, true, utr)}>
              {t("payrow.confirmed")}
            </button>
            <button type={C.button} className={C.danger} onClick={() => void settle(showing.payment.id, false)}>
              {t("job.not_received")}
            </button>
            <button type={C.button} className={C.quiet} onClick={() => setShowing(undefined)}>
              {t("getpaid.later")}
            </button>
          </div>
        </div>
      )}

      {mine.length > 0 && (
        <section className={C.stack}>
          <div className={C.row}>
            <span className={C.label}>{t("getpaid.this_job")}</span>
            <span className={`${C.faint} end`}>
              {t("getpaid.summary", { received: `₹${rupees(sum.confirmed)}`, waiting: `₹${rupees(sum.outstanding)}` })}
            </span>
          </div>
          <div className="ledger">
            {mine.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                actions={
                  OPEN_PAYMENT.has(p.status) && !showing
                    ? {
                        ...(p.method === PaymentMethod.enum.upi ? { qr: () => void run(() => show(p)) } : {}),
                        received: () => void settle(p.id, true),
                        notReceived: () => void settle(p.id, false),
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
