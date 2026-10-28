import { rupees, summarize } from "@gigsync/core";
import { useI18n } from "../i18n.js";
import { PaymentRow } from "../payments/PaymentRow.js";
import { jobLabel } from "../payments/store.js";
import type { GigData } from "../state.js";
import { C } from "../ui/cls.js";

/** Their working record: every job and payment, kept on this phone, for a union, helpline or welfare board. */
export function Record({ data }: { data: GigData }) {
  const { t } = useI18n();
  const sum = summarize(data.payments);
  const label = new Map(data.jobs.map((j) => [j.id, jobLabel(j)]));
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("nav.record")}</span>
        <h1 className={C.headline}>
          {t("record.headline")} <span className={C.soft}>{t("record.soft")}</span>
        </h1>
        <p className={C.muted}>{t("record.about")}</p>
      </div>

      <div className="stats">
        <div>
          <span className={C.label}>{t("stat.jobs")}</span>
          <b>{data.jobs.length}</b>
        </div>
        <div>
          <span className={C.label}>{t("stat.received")}</span>
          <b className={C.money}>₹{rupees(sum.confirmed)}</b>
        </div>
        <div>
          <span className={C.label}>{t("stat.waiting")}</span>
          <b className={C.money}>₹{rupees(sum.outstanding)}</b>
        </div>
      </div>

      {data.ready && data.payments.length === 0 && <div className={C.empty}>{t("record.empty")}</div>}
      {data.payments.length > 0 && (
        <div className="ledger">
          {data.payments.map((p) => (
            <PaymentRow key={p.id} payment={p} context={label.get(p.engagement) ?? ""} />
          ))}
        </div>
      )}
    </>
  );
}
