import { type Ports, passbook, type WaitingFrom, waitingBy, weekPayments, workRecord } from "@gigsync/core";
import { type EngagementId, Role } from "@gigsync/protocol";
import { useMemo, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { type I18n, useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";
import { DownloadRecord } from "./DownloadRecord.js";
import { MoneyHead } from "./MoneyHead.js";
import { NotCompleted } from "./NotCompleted.js";
import type { CardProps } from "./RecordLine.js";
import { whoOf } from "./text.js";
import { UpiLine } from "./UpiLine.js";
import { phoneOffset, useRecords } from "./useRecords.js";
import { WorkDone } from "./WorkDone.js";

type Props = CardProps & {
  account: Account;
  ports: Ports;
  /** Opens About me, where the UPI ID is saved and changed. */
  onAddPayee: () => void;
};

/** The waiting tile's words: who the money waits on when it is one household, how many when it is several. */
function waitingLabel(t: I18n["t"], waiting: readonly WaitingFrom[], names: Readonly<Record<string, string>>): string {
  const [only] = waiting;
  if (!only) return t("stat.waiting");
  if (waiting.length > 1) return t("ledger.waiting_many", { count: waiting.length });
  return t("ledger.waiting_from", { name: whoOf(only.job, names, t("job.customer")) });
}

/**
 * A worker's Money tab (design W15): what came this week, with how many payments; this month and what is waiting,
 * named by household; what nobody has asked for yet. Then completed work by month, newest first (done and paid one-off
 * jobs, monthly work once it ended, jobs restored from GigSync's record on a new phone), each row opening to the job's
 * own card; a fold of jobs not completed; the work record to download; and the UPI ID payers see.
 */
export function WorkerRecords({ account, ports, onAddPayee, ...card }: Props) {
  const { t, plural } = useI18n();
  const { view } = card;
  const me = account.session.user;
  const [openId, setOpenId] = useState<EngagementId>();
  const now = useMemo(() => new Date(), []);
  const { done, notDone } = useRecords(view, now);
  const { book, record } = useMemo(
    () => ({
      book: passbook(view.jobs, view.payments, me, now, phoneOffset(now)),
      record: workRecord(done, view.payments, me, now, phoneOffset(now)),
    }),
    [view.jobs, view.payments, done, me, now],
  );
  const { totals } = book;
  const count = weekPayments(book.rows, now, phoneOffset(now));
  const onToggle = (id: EngagementId) => setOpenId((open) => (open === id ? undefined : id));

  return (
    <>
      <MoneyHead
        paise={totals.week}
        label={t("passbook.week")}
        aside={count > 0 ? plural("ledger.week_count", count) : undefined}
        stats={[
          { id: "month", paise: totals.month, label: t("ledger.this_month") },
          { id: "waiting", paise: totals.waiting, label: waitingLabel(t, waitingBy(book.rows), view.names) },
        ]}
      />
      {totals.notAsked > 0 && (
        <p className="money-line">
          <span>{t("passbook.not_asked")}</span>
          <b className={C.money}>{money(totals.notAsked)}</b>
        </p>
      )}
      {record.months.length === 0 ? (
        <p className={C.empty}>{t("passbook.empty")}</p>
      ) : (
        <WorkDone record={record} openId={openId} onToggle={onToggle} onAddPayee={onAddPayee} {...card} />
      )}
      <NotCompleted jobs={notDone} onAddPayee={onAddPayee} {...card} />
      <DownloadRecord account={account} side={Role.enum.provider} />
      <UpiLine ports={ports} onChange={onAddPayee} />
    </>
  );
}
