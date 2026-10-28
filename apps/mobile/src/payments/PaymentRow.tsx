import { type MessageKey, rupees } from "@gigsync/core";
import { type Payment, PaymentStatus } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";

const S = PaymentStatus.enum;
const STATUS: Readonly<Record<Payment["status"], { text: MessageKey; cls: string }>> = {
  [S.requested]: { text: "payrow.requested", cls: "tag wait" },
  [S.paid]: { text: "payrow.paid", cls: "tag talk" },
  [S.confirmed]: { text: "payrow.confirmed", cls: "tag fresh" },
  [S.disputed]: { text: "payrow.disputed", cls: "tag danger" },
};

interface Props {
  payment: Payment;
  /** Shown under the amount, e.g. the job it belongs to. */
  context?: string;
  actions?: { qr?: () => void; received: () => void; notReceived: () => void } | undefined;
}

/** One line of their record: amount, status, method, reference and when. */
export function PaymentRow({ payment: p, context, actions }: Props) {
  const { t, date } = useI18n();
  const status = STATUS[p.status];
  const when = p.confirmed_at ?? p.paid_at ?? p.requested_at;
  return (
    <div>
      <strong className={C.money}>₹{rupees(p.amount_paise)}</strong>
      <span className={status.cls}>{t(status.text)}</span>
      <div className="meta">
        {context && <span>{context}</span>}
        <span>{t(`method.${p.method}`)}</span>
        {p.utr && <span>{t("payrow.ref", { utr: p.utr })}</span>}
        {p.note && <span>{p.note}</span>}
        {when && <span>{date(new Date(when))}</span>}
        {actions && (
          <span className={C.row}>
            {actions.qr && (
              <button type={C.button} className={C.linkBtn} onClick={actions.qr}>
                {t("payrow.qr")}
              </button>
            )}
            <button type={C.button} className={C.linkBtn} onClick={actions.received}>
              {t("payrow.confirmed")}
            </button>
            <button type={C.button} className={C.linkBtn} onClick={actions.notReceived}>
              {t("payrow.disputed")}
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
