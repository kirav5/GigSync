import { type MessageKey, type PassbookTotals, passbook } from "@gigsync/core";
import type { UserId } from "@gigsync/protocol";
import { useMemo } from "react";
import { useI18n } from "../i18n.js";
import { PaymentRow } from "../payments/PaymentRow.js";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";
import type { GigView } from "../useGig.js";
import "../payments/money.css";

/** The four totals, in the order a worker asks about them. */
const TOTALS: readonly { key: keyof PassbookTotals; label: MessageKey }[] = [
  { key: "week", label: "passbook.week" },
  { key: "month", label: "passbook.month" },
  { key: "waiting", label: "stat.waiting" },
  { key: "notAsked", label: "passbook.not_asked" },
];

/** Money from jobs both sides signed on GigSync, with this week's and this month's totals. */
export function Passbook({ view, me }: { view: GigView; me: UserId }) {
  const { t } = useI18n();
  // The phone's own offset from UTC decides where its week and month begin.
  const { rows, totals } = useMemo(
    () => passbook(view.jobs, view.payments, me, new Date(), -new Date().getTimezoneOffset()),
    [view.jobs, view.payments, me],
  );

  return (
    <>
      <div className={C.stack}>
        <h1 className={C.headline}>
          {t("passbook.headline")} <span className={C.soft}>{t("passbook.soft")}</span>
        </h1>
      </div>

      <div className="passbook-totals">
        {TOTALS.map(({ key, label }) => (
          <div key={key}>
            <span className={C.label}>{t(label)}</span>
            <b>{money(totals[key])}</b>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className={C.empty}>{t("passbook.empty")}</p>
      ) : (
        <ul className="passbook-list" aria-label={t("nav.passbook")}>
          {rows.map(({ job, payment, at }) => {
            const who = job.contact?.name || view.names[job.engagement.counterpart] || t("job.customer");
            return (
              <li key={payment.id}>
                <PaymentRow payment={payment} at={at} context={`${who} · ${t(`trade.${job.request.trade}`)}`} />
              </li>
            );
          })}
        </ul>
      )}

      <p className={C.faint}>{t("passbook.about")}</p>
    </>
  );
}
