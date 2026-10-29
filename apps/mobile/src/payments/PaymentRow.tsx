import type { MessageKey } from "@gigsync/core";
import { type Payment, PaymentStatus } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";

const S = PaymentStatus.enum;
const STATUS: Readonly<Record<Payment["status"], { text: MessageKey; cls: string }>> = {
  [S.requested]: { text: "payrow.requested", cls: "tag wait" },
  [S.paid]: { text: "payrow.paid", cls: "tag talk" },
  [S.confirmed]: { text: "payrow.confirmed", cls: "tag fresh" },
  [S.disputed]: { text: "payrow.disputed", cls: "tag danger" },
};

interface Props {
  payment: Payment;
  /** When it is filed under: received, paid or asked. */
  at: Date;
  /** Shown under the amount: who paid, and for what. */
  context?: string;
}

/**
 * One line of the passbook: amount, status, method, reference and when. The payment's note is left out: it is the
 * customer's words, possibly in a language the worker does not read.
 */
export function PaymentRow({ payment: p, at, context }: Props) {
  const { t, date } = useI18n();
  const status = STATUS[p.status];
  return (
    <div>
      <strong className={C.money}>{money(p.amount_paise)}</strong>
      <span className={status.cls}>{t(status.text)}</span>
      <div className="meta">
        <span>{date(at)}</span>
        {context && <span>{context}</span>}
        <span>{t(`method.${p.method}`)}</span>
        {p.utr && <span>{t("payrow.ref", { utr: p.utr })}</span>}
      </div>
    </div>
  );
}
