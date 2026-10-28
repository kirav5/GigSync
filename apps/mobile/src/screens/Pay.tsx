import type { PaymentBook } from "@gigsync/core";
import { useI18n } from "../i18n.js";
import { GetPaid } from "../payments/GetPaid.js";
import { jobLabel } from "../payments/store.js";
import { type GigData, Screen } from "../state.js";
import { C } from "../ui/cls.js";

interface Props {
  data: GigData;
  book: PaymentBook;
  jobId: string | undefined;
  onJob: (id: string) => void;
  go: (s: Screen) => void;
  changed: () => Promise<void>;
}

/** Get paid for a job: pick it, show their UPI QR, record what arrived. */
export function Pay({ data, book, jobId, onJob, go, changed }: Props) {
  const { t } = useI18n();
  const job = data.jobs.find((j) => j.id === jobId) ?? data.jobs[0];
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("nav.pay")}</span>
        <h1 className={C.headline}>
          {t("pay.headline")} <span className={C.soft}>{t("pay.soft")}</span>
        </h1>
        <p className={C.muted}>{t("pay.about")}</p>
      </div>

      {data.ready && !data.payee && (
        <div className={C.cardWait}>
          <strong>{t("pay.first_upi")}</strong>
          <div>
            <button type={C.button} className={C.accent} onClick={() => go(Screen.profile)}>
              {t("today.add_upi")}
            </button>
          </div>
        </div>
      )}
      {data.ready && data.jobs.length === 0 && (
        <div className={C.empty}>
          {t("pay.no_jobs")}
          <button type={C.button} className={C.btn} onClick={() => go(Screen.jobs)}>
            {t("pay.record_job")}
          </button>
        </div>
      )}

      {job && (
        <label className={C.fieldLabel}>
          <span className={C.label}>{t("pay.job")}</span>
          <select className={C.field} value={job.id} onChange={(e) => onJob(e.target.value)}>
            {data.jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {jobLabel(j)}
              </option>
            ))}
          </select>
        </label>
      )}
      {job && data.payee && data.self && (
        <GetPaid
          key={job.id}
          book={book}
          job={job}
          payee={data.payee}
          self={data.self}
          payments={data.payments}
          changed={changed}
        />
      )}
    </>
  );
}
