import { buildUpiUri, type PaymentBook, type PaymentSummary, rupees } from "@gigsync/core";
import {
  type Engagement,
  PAISE_PER_RUPEE,
  type Payment,
  PaymentMethod,
  PaymentStatus,
  UPI_MAX_PAISE,
  type UserId,
} from "@gigsync/protocol";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { qrDataUrl } from "./qr.js";
import type { Payee } from "./store.js";

const BUTTON = "button";
const SECONDARY = "secondary";
const LINK = "link";
const S = PaymentStatus.enum;
/** Payments she can still settle: confirm as received, or dispute. */
const OPEN: ReadonlySet<Payment["status"]> = new Set([S.requested, S.paid]);

interface Props {
  book: PaymentBook;
  job: Engagement;
  payee: Payee;
  self: UserId;
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

/** One job's payments: ask for an amount, show her UPI QR, then record what arrived. */
export function GetPaid({ book, job, payee, self }: Props) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [utr, setUtr] = useState("");
  const [showing, setShowing] = useState<Showing>();
  const [history, setHistory] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>();
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setHistory(await book.forEngagement(job.id));
    setSummary(await book.summary(job.id));
  }, [book, job.id]);

  useEffect(() => {
    setShowing(undefined);
    void refresh();
  }, [refresh]);

  async function run(step: () => Promise<void>) {
    setError(undefined);
    try {
      await step();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  /** Back to an empty form once a payment is settled. */
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
    <section className="pay">
      {!showing && (
        <form className="pay-form" onSubmit={showQr}>
          <input
            inputMode="decimal"
            placeholder="Amount (₹)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            placeholder="Note, e.g. week 1"
            maxLength={50}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button type="submit">Show QR</button>
          <button type={BUTTON} className={SECONDARY} onClick={() => void paidInCash()}>
            Paid in cash
          </button>
        </form>
      )}
      {showing && (
        <div className="qr">
          <img src={showing.qr} alt={`UPI QR for ₹${rupees(showing.payment.amount_paise)} to ${payee.vpa}`} />
          <strong>
            ₹{rupees(showing.payment.amount_paise)} to {payee.vpa}
          </strong>
          <small>Ask the customer to scan with any UPI app.</small>
          <a href={showing.uri}>Open in a UPI app on this phone</a>
          <input
            inputMode="numeric"
            placeholder="UPI reference no. (optional, 12 digits)"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
          />
          <div className="row">
            <button type={BUTTON} onClick={() => void settle(showing.payment.id, true, utr)}>
              Received
            </button>
            <button type={BUTTON} className={SECONDARY} onClick={() => void settle(showing.payment.id, false)}>
              Not received
            </button>
            <button type={BUTTON} className={SECONDARY} onClick={() => setShowing(undefined)}>
              Later
            </button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {summary && summary.requested > 0 && (
        <p className="totals">
          Received ₹{rupees(summary.confirmed)} · waiting ₹{rupees(summary.outstanding)}
        </p>
      )}
      <ul className="payments">
        {history.map((p) => (
          <li key={p.id}>
            ₹{rupees(p.amount_paise)} · {p.method} · {p.status}
            {p.utr && ` · ref ${p.utr}`}
            {p.note && ` · ${p.note}`}
            {OPEN.has(p.status) && !showing && (
              <span className="row-actions">
                {p.method === PaymentMethod.enum.upi && (
                  <button type={BUTTON} className={LINK} onClick={() => void run(() => show(p))}>
                    QR
                  </button>
                )}
                <button type={BUTTON} className={LINK} onClick={() => void settle(p.id, true)}>
                  received
                </button>
                <button type={BUTTON} className={LINK} onClick={() => void settle(p.id, false)}>
                  not received
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
