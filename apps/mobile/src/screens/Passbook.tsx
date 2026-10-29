import { type GigDevice, type MessageKey, type PassbookTotals, passbook, workRecord } from "@gigsync/core";
import type { EngagementId, UserId } from "@gigsync/protocol";
import { useMemo, useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";
import type { GigView } from "../useGig.js";
import { WorkDone } from "./record/WorkDone.js";
import "../payments/money.css";

/** The four totals, in the order a worker asks about them. */
const TOTALS: readonly { key: keyof PassbookTotals; label: MessageKey }[] = [
  { key: "week", label: "passbook.week" },
  { key: "month", label: "passbook.month" },
  { key: "waiting", label: "stat.waiting" },
  { key: "notAsked", label: "passbook.not_asked" },
];

interface Props {
  view: GigView;
  me: UserId;
  /** For a record row opened in place: the job's own money actions. */
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  onAddPayee: () => void;
}

/**
 * Money and work from jobs both sides signed on GigSync: this week's and this month's totals, then every finished job
 * by month with where its money stands. A row opens to the job's own card, one at a time.
 */
export function Passbook({ view, me, device, run, onAddPayee }: Props) {
  const { t } = useI18n();
  const [openId, setOpenId] = useState<EngagementId>();
  const { totals, record } = useMemo(() => {
    const now = new Date();
    // The phone's own offset from UTC decides where its week and month begin.
    const offset = -now.getTimezoneOffset();
    return {
      totals: passbook(view.jobs, view.payments, me, now, offset).totals,
      record: workRecord(view.jobs, view.payments, me, now, offset),
    };
  }, [view.jobs, view.payments, me]);
  const rows = {
    view,
    device,
    run,
    onAddPayee,
    openId,
    onToggle: (id: EngagementId) => setOpenId((open) => (open === id ? undefined : id)),
  };

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

      {record.signed === 0 ? <p className={C.empty}>{t("passbook.empty")}</p> : <WorkDone record={record} {...rows} />}

      <p className={C.faint}>{t("passbook.about")}</p>
    </>
  );
}
