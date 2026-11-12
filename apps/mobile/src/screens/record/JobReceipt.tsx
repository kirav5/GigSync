import { jobDay, type RecordRow } from "@gigsync/core";
import { Role } from "@gigsync/protocol";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { requestWork } from "../../ui/work.js";
import { FileSaid } from "./FileSaid.js";
import { dayMonthText, whoOf } from "./text.js";
import { fileName, PullState, useRecordFile } from "./useRecordFile.js";
import "./record.css";

/** The file's name before the job's day: no person's name in it, so it can be sent on as it is. */
const FILE_PREFIX = "gigsync-job-record-";
/** Between the parts of a job's line. */
const PARTS = " · ";
/** Small print (styles.css): a job's line, and what the fold says under its jobs. */
const FINE = "fine";

interface Props {
  account: Account;
  /** The worker's finished jobs on this phone, newest first. */
  rows: readonly RecordRow[];
  names: Readonly<Record<string, string>>;
}

/**
 * "Receipts for one job" (design W16): the record of a single job, as GigSync keeps it, saved as a file the worker can
 * show anyone, such as a wage helpline, without the rest of her work. She picks the job from her own list on this
 * phone; the file is the same as one line of her whole work record.
 */
export function JobReceipt({ account, rows, names }: Props) {
  const { lang, t } = useI18n();
  const { pull, save } = useRecordFile(account);
  const loading = pull.state === PullState.loading;
  const title = t("ledger.share_job");
  return (
    <details className="list-fold">
      <summary className="list-row">
        <span className="list-row-icon">
          <Icon name="doc" size={20} />
        </span>
        <span className="list-row-text">
          <span className="list-row-title">{title}</span>
          <span className="list-row-sub">{t("ledger.share_job_sub")}</span>
        </span>
        <span className="list-row-chev">
          <Icon name="chev_down" size={18} />
        </span>
      </summary>
      <div className="receipt-pick">
        {rows.length === 0 ? (
          <p className={FINE}>{t("ledger.record_none")}</p>
        ) : (
          <ul className="receipt-jobs" aria-label={title}>
            {rows.map(({ job, day }) => (
              <li key={job.engagement.id}>
                <button
                  type={C.button}
                  className="receipt-job"
                  disabled={loading}
                  onClick={() =>
                    void save({
                      side: Role.enum.provider,
                      keep: (kept) => kept.engagement === job.engagement.id,
                      name: (kept) => fileName(FILE_PREFIX, jobDay(kept)),
                    })
                  }
                >
                  <span>{whoOf(job, names, t("job.customer"))}</span>{" "}
                  <span className={FINE}>
                    {requestWork(t, job.request)}
                    {PARTS}
                    {dayMonthText(lang, day)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {loading && <span className={FINE}>{t("records.export_loading")}</span>}
        <FileSaid pull={pull} empty="ledger.job_missing" />
      </div>
    </details>
  );
}
