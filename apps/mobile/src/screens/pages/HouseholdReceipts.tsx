import { paidTotal, type Receipt, receiptsOf } from "@gigsync/core";
import type { PaymentId, UserId } from "@gigsync/protocol";
import { useMemo, useState } from "react";
import { type I18n, useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";
import { ScreenHead } from "../../ui/ScreenHead.js";
import { type CardProps, RecordLine } from "../record/RecordLine.js";
import { type Chip, Tag, whoOf } from "../record/text.js";
import "../../payments/money.css";

type Props = CardProps & { me: UserId };

/** Paid and confirmed by the worker reads green; paid on the household's word alone waits for them. */
function chipOf(t: I18n["t"], { payment, confirmed }: Receipt): Chip {
  const price = money(payment.amount_paise);
  return confirmed
    ? { text: t("page.paid", { price }), cls: Tag.fresh }
    : { text: t("page.paid_unconfirmed", { price }), cls: Tag.wait };
}

/** How it was paid (UPI or cash), and the UPI reference when the household gave one. */
function factsOf(t: I18n["t"], { payment }: Receipt): string[] {
  const method = t(`method.${payment.method}`);
  return payment.utr ? [method, t("payrow.ref", { utr: payment.utr })] : [method];
}

/**
 * A household's Receipts: what they paid on GigSync, from the jobs and payments on this phone (core's `receiptsOf`),
 * newest first under the total. Each row has the date, the worker, the trade, the amount, how it was paid and whether
 * the worker confirmed it; it opens the job's own card in place, one at a time, as the worker's Passbook does.
 */
export function HouseholdReceipts({ view, me, ...card }: Props) {
  const { date, t } = useI18n();
  const [openId, setOpenId] = useState<PaymentId>();
  const receipts = useMemo(() => receiptsOf(view.jobs, view.payments, me), [view.jobs, view.payments, me]);
  const title = t("nav.receipts");
  return (
    <>
      <ScreenHead head={title} soft={t("page.receipts_soft")} />
      <div className="passbook-totals">
        <div>
          <span className={C.label}>{t("page.receipts_total")}</span>
          <b>{money(paidTotal(receipts))}</b>
        </div>
      </div>
      {receipts.length === 0 ? (
        <p className={C.empty}>{t("page.receipts_empty")}</p>
      ) : (
        <ul className="record-list" aria-label={title}>
          {receipts.map((receipt) => {
            const { job, payment, at } = receipt;
            // By payment, not job: monthly work paid twice is two rows, and only the one tapped opens.
            const id = payment.id;
            return (
              <RecordLine
                key={id}
                job={job}
                when={date(at)}
                who={whoOf(job, view.names, t("job.worker"))}
                price={payment.amount_paise}
                chip={chipOf(t, receipt)}
                facts={factsOf(t, receipt)}
                open={openId === id}
                onToggle={() => setOpenId((open) => (open === id ? undefined : id))}
                view={view}
                {...card}
              />
            );
          })}
        </ul>
      )}
    </>
  );
}
