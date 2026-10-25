import { buildUpiUri, type PaymentBook, rupees, summarize } from "@gigsync/core";
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

/** "450" or "450.50" → paise, or a message saying what is wrong. */
function toPaise(text: string): number {
  const value = Number(text.trim());
  if (!text.trim() || !Number.isFinite(value) || value <= 0) throw new Error("Enter the amount in rupees, e.g. 450.");
  const paise = Math.round(value * PAISE_PER_RUPEE);
  if (paise > UPI_MAX_PAISE) throw new Error(`UPI allows up to ₹${rupees(UPI_MAX_PAISE)} per payment.`);
  return paise;
}

/** One job's payments: ask for an amount, show their UPI QR, then record what arrived. */
export function GetPaid({ book, job, payee, self, payments, changed }: Props) {
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
      setError(e instanceof Error ? e.message : String(e));
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
        if (ref.trim()) await book.markPaid(id, ref.trim());
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
            <span className={C.label}>Amount (₹)</span>
            <input
              className={C.field}
              inputMode="decimal"
              placeholder="Amount in rupees"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className={C.fieldLabel}>
            <span className={C.label}>Note for the customer (optional)</span>
            <input
              className={C.field}
              placeholder="Optional"
              maxLength={50}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {error && <p className={C.error}>{error}</p>}
          <div className={C.row}>
            <button type="submit" className={C.accent}>
              Show QR
            </button>
            <button type={C.button} className={C.secondary} onClick={() => void paidInCash()}>
              Paid in cash
            </button>
          </div>
        </form>
      )}

      {showing && (
        <div className={`${C.card} qr`}>
          <span className={C.labelSq}>Scan to pay</span>
          <img src={showing.qr} alt={`UPI QR for ₹${rupees(showing.payment.amount_paise)} to ${payee.vpa}`} />
          <span className="amount">₹{rupees(showing.payment.amount_paise)}</span>
          <span className={C.muted}>
            to {payee.name} · {payee.vpa}
          </span>
          <span className={C.faint}>The customer scans with any UPI app. The money goes straight to your bank.</span>
          <a className={C.secondary} href={showing.uri}>
            Open in a UPI app on this phone
          </a>
          <input
            className={C.field}
            inputMode="numeric"
            placeholder="UPI reference no. (optional, 12 digits)"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
          />
          {error && <p className={C.error}>{error}</p>}
          <div className={C.row}>
            <button type={C.button} className={C.accent} onClick={() => void settle(showing.payment.id, true, utr)}>
              Received
            </button>
            <button type={C.button} className={C.danger} onClick={() => void settle(showing.payment.id, false)}>
              Not received
            </button>
            <button type={C.button} className={C.quiet} onClick={() => setShowing(undefined)}>
              Later
            </button>
          </div>
        </div>
      )}

      {mine.length > 0 && (
        <section className={C.stack}>
          <div className={C.row}>
            <span className={C.label}>This job</span>
            <span className={`${C.faint} end`}>
              Received ₹{rupees(sum.confirmed)} · waiting ₹{rupees(sum.outstanding)}
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
