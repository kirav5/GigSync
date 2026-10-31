import { type MessageKey, type PassbookTotals, passbook, workRecord } from "@gigsync/core";
import type { EngagementId } from "@gigsync/protocol";
import { useMemo, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";
import { ScreenHead } from "../../ui/ScreenHead.js";
import { DownloadRecord } from "./DownloadRecord.js";
import { NotCompleted } from "./NotCompleted.js";
import type { CardProps } from "./RecordLine.js";
import { phoneOffset, useRecords } from "./useRecords.js";
import { WorkDone } from "./WorkDone.js";
import "../../payments/money.css";

/** The four earnings tiles, in the order a worker asks about them. */
const TOTALS: readonly { key: keyof PassbookTotals; label: MessageKey }[] = [
  { key: "week", label: "passbook.week" },
  { key: "month", label: "passbook.month" },
  { key: "waiting", label: "stat.waiting" },
  { key: "notAsked", label: "passbook.not_asked" },
];

type Props = CardProps & { account: Account };

/**
 * A worker's Records: completed work only (done and paid one-off jobs, monthly work once it ended, and jobs restored
 * from GigSync's record on a new phone), newest first by month under the earnings tiles; then a small fold of jobs not
 * completed, and one quiet row to download the work record GigSync keeps. A row opens to the job's own card.
 */
export function WorkerRecords({ account, ...card }: Props) {
  const { t } = useI18n();
  const { view } = card;
  const me = account.session.user;
  const [openId, setOpenId] = useState<EngagementId>();
  const now = useMemo(() => new Date(), []);
  const { done, notDone } = useRecords(view, now);
  const { totals, record } = useMemo(
    () => ({
      totals: passbook(view.jobs, view.payments, me, now, phoneOffset(now)).totals,
      record: workRecord(done, view.payments, me, now, phoneOffset(now)),
    }),
    [view.jobs, view.payments, done, me, now],
  );
  const onToggle = (id: EngagementId) => setOpenId((open) => (open === id ? undefined : id));

  return (
    <>
      <ScreenHead head={t("nav.records")} soft={t("page.records_soft_worker")} />
      <div className="passbook-totals">
        {TOTALS.map(({ key, label }) => (
          <div key={key}>
            <span className={C.label}>{t(label)}</span>
            <b>{money(totals[key])}</b>
          </div>
        ))}
      </div>
      {record.months.length === 0 ? (
        <p className={C.empty}>{t("passbook.empty")}</p>
      ) : (
        <WorkDone record={record} openId={openId} onToggle={onToggle} {...card} />
      )}
      <NotCompleted jobs={notDone} {...card} />
      <DownloadRecord account={account} />
      <p className={C.faint}>{t("passbook.about")}</p>
    </>
  );
}
