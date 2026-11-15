import { agreedPrice, type PaidRow, paidRecord, paidTotals, paidWork, receiptsOf } from "@gigsync/core";
import { type EngagementId, Role } from "@gigsync/protocol";
import { useMemo, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { type I18n, useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";
import { DownloadRecord } from "./DownloadRecord.js";
import { MoneyHead } from "./MoneyHead.js";
import { MonthGroup } from "./MonthGroup.js";
import { NotCompleted } from "./NotCompleted.js";
import { type CardProps, RecordLine } from "./RecordLine.js";
import { type Chip, monthText, Tag, weekdayText, whoOf } from "./text.js";
import { phoneOffset, useRecords } from "./useRecords.js";

type Props = CardProps & { account: Account };

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
 * A household's Pay tab (design H13): every rupee they said they paid on GigSync since the first, this month's, and
 * what the worker has not confirmed yet; then the work done for them by month, newest first, each row opening the
 * job's own card in place, one at a time; a fold of jobs not completed; and their receipts to download.
 */
export function HouseholdRecords({ account, ...card }: Props) {
  const { lang, t } = useI18n();
  const { view } = card;
  const me = account.session.user;
  const [openId, setOpenId] = useState<EngagementId>();
  const now = useMemo(() => new Date(), []);
  const { done, notDone } = useRecords(view, now);
  const { record, totals } = useMemo(
    () => ({
      record: paidRecord(paidWork(done, view.jobs, view.payments, me), view.payments, me, now, phoneOffset(now)),
      totals: paidTotals(receiptsOf(view.jobs, view.payments, me), now, phoneOffset(now)),
    }),
    [done, view.jobs, view.payments, me, now],
  );
  const onToggle = (id: EngagementId) => setOpenId((open) => (open === id ? undefined : id));
  return (
    <>
      <MoneyHead
        paise={totals.all}
        label={t("page.records_total")}
        aside={totals.since && t("record.since", { month: monthText(lang, totals.since) })}
        stats={[
          { id: "month", paise: totals.month, label: t("ledger.this_month") },
          { id: "unconfirmed", paise: totals.unconfirmed, label: t("ledger.not_confirmed") },
        ]}
      />
      {record.months.length === 0 ? (
        <p className={C.empty}>{t("page.records_empty")}</p>
      ) : (
        <section className="record">
          {record.months.map(({ month, rows }) => (
            <MonthGroup key={month} month={month}>
              {rows.map((row) => {
                const id = row.job.engagement.id;
                return (
                  <RecordLine
                    key={id}
                    job={row.job}
                    when={weekdayText(lang, row.day)}
                    who={whoOf(row.job, view.names, t("job.worker"))}
                    price={agreedPrice(row.job)}
                    settled={row.confirmed}
                    chip={chipOf(t, row)}
                    facts={factsOf(t, row)}
                    open={openId === id}
                    onToggle={() => onToggle(id)}
                    {...card}
                  />
                );
              })}
            </MonthGroup>
          ))}
        </section>
      )}
      <NotCompleted jobs={notDone} {...card} />
      <DownloadRecord account={account} side={Role.enum.requester} />
    </>
  );
}
