import { rupees } from "@gigsync/core";
import { type Payment, PaymentStatus } from "@gigsync/protocol";
import { C } from "../ui/cls.js";

const S = PaymentStatus.enum;
const STATUS: Readonly<Record<Payment["status"], { text: string; cls: string }>> = {
  [S.requested]: { text: "Waiting", cls: "tag wait" },
  [S.paid]: { text: "Customer says paid", cls: "tag talk" },
  [S.confirmed]: { text: "Received", cls: "tag fresh" },
  [S.disputed]: { text: "Not received", cls: "tag danger" },
};

interface Props {
  payment: Payment;
  /** Shown under the amount, e.g. the job it belongs to. */
  context?: string;
  actions?: { qr?: () => void; received: () => void; notReceived: () => void } | undefined;
}

/** One line of her record: amount, status, method, reference and when. */
export function PaymentRow({ payment: p, context, actions }: Props) {
  const status = STATUS[p.status];
  const when = p.confirmed_at ?? p.paid_at ?? p.requested_at;
  return (
    <div>
      <strong className={C.money}>₹{rupees(p.amount_paise)}</strong>
      <span className={status.cls}>{status.text}</span>
      <div className="meta">
        {context && <span>{context}</span>}
        <span>{p.method.toUpperCase()}</span>
        {p.utr && <span>ref {p.utr}</span>}
        {p.note && <span>{p.note}</span>}
        {when && <span>{new Date(when).toLocaleDateString()}</span>}
        {actions && (
          <span className={C.row}>
            {actions.qr && (
              <button type={C.button} className={C.linkBtn} onClick={actions.qr}>
                QR
              </button>
            )}
            <button type={C.button} className={C.linkBtn} onClick={actions.received}>
              Received
            </button>
            <button type={C.button} className={C.linkBtn} onClick={actions.notReceived}>
              Not received
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
