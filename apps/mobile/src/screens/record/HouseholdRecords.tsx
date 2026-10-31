import { agreedPrice, type PaidRow, paidRecord, type RecordMonth } from "@gigsync/core";
import type { EngagementId, UserId } from "@gigsync/protocol";
import { useId, useMemo, useState } from "react";
import { type I18n, useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";
import { ScreenHead } from "../../ui/ScreenHead.js";
import { NotCompleted } from "./NotCompleted.js";
import { type CardProps, type OpenRow, RecordLine } from "./RecordLine.js";
import { type Chip, monthText, Tag, weekdayText, whoOf } from "./text.js";
import { phoneOffset, useRecords } from "./useRecords.js";
import "../../payments/money.css";
import "./record.css";

type Props = CardProps & { me: UserId };

/** Paid and confirmed by the worker reads green; paid on the household's word alone waits for them. */
function chipOf(t: I18n["t"], { paid_paise, confirmed }: PaidRow): Chip {
  if (paid_paise === 0) return { text: t("page.not_paid"), cls: Tag.plain };
  const price = money(paid_paise);
  return confirmed
    ? { text: t("page.paid", { price }), cls: Tag.fresh }
    : { text: t("page.paid_unconfirmed", { price }), cls: Tag.wait };
}

/** How it was paid (UPI or cash), and each UPI reference the household gave. */
function factsOf(t: I18n["t"], { payments }: PaidRow): string[] {
  const methods = [...new Set(payments.map((p) => t(`method.${p.method}`)))];
  const refs = payments.flatMap((p) => (p.utr ? [t("payrow.ref", { utr: p.utr })] : []));
  return [...methods, ...refs];
}

/**
 * A household's Records: the work done for them on GigSync and what they paid for it, one row per completed job,
 * newest first by month under the total; then a small fold of jobs not completed. A row opens the job's own card in
 * place, one at a time, as the worker's Records does.
 */
export function HouseholdRecords({ me, ...card }: Props) {
  const { t } = useI18n();
  const { view } = card;
  const [openId, setOpenId] = useState<EngagementId>();
  const now = useMemo(() => new Date(), []);
  const { done, notDone } = useRecords(view, now);
  const record = useMemo(
    () => paidRecord(done, view.payments, me, now, phoneOffset(now)),
    [done, view.payments, me, now],
  );
  const onToggle = (id: EngagementId) => setOpenId((open) => (open === id ? undefined : id));
  return (
    <>
      <ScreenHead head={t("nav.records")} soft={t("page.records_soft")} />
      <div className="passbook-totals single">
        <div>
          <span className={C.label}>{t("page.records_total")}</span>
          <b>{money(record.paid_paise)}</b>
        </div>
      </div>
      {record.months.length === 0 ? (
        <p className={C.empty}>{t("page.records_empty")}</p>
      ) : (
        <section className="record">
          {record.months.map((m) => (
            <Month key={m.month} {...m} openId={openId} onToggle={onToggle} {...card} />
          ))}
        </section>
      )}
      <NotCompleted jobs={notDone} {...card} />
    </>
  );
}

/** One month's heading, in the owner's language, over what was paid for each job done that month. */
function Month({ month, rows, openId, onToggle, ...card }: RecordMonth<PaidRow> & CardProps & OpenRow) {
  const { lang, t } = useI18n();
  const heading = useId();
  return (
    <div className="record-month">
      <h3 id={heading}>{monthText(lang, month)}</h3>
      <ul className="record-list" aria-labelledby={heading}>
        {rows.map((row) => {
          const id = row.job.engagement.id;
          return (
            <RecordLine
              key={id}
              job={row.job}
              when={weekdayText(lang, row.day)}
              who={whoOf(row.job, card.view.names, t("job.worker"))}
              price={agreedPrice(row.job)}
              chip={chipOf(t, row)}
              facts={factsOf(t, row)}
              open={openId === id}
              onToggle={() => onToggle(id)}
              {...card}
            />
          );
        })}
      </ul>
    </div>
  );
}
