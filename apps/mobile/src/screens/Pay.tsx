import type { PaymentBook } from "@gigsync/core";
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

/** Get paid for a job: pick it, show her UPI QR, record what arrived. */
export function Pay({ data, book, jobId, onJob, go, changed }: Props) {
  const job = data.jobs.find((j) => j.id === jobId) ?? data.jobs[0];
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>Get paid</span>
        <h1 className={C.headline}>
          Paid to you. <span className={C.soft}>Recorded for you.</span>
        </h1>
        <p className={C.muted}>Free UPI, straight to your bank. GigSync never holds or moves the money.</p>
      </div>

      {data.ready && !data.payee && (
        <div className={C.cardWait}>
          <strong>First, add your UPI ID</strong>
          <div>
            <button type={C.button} className={C.accent} onClick={() => go(Screen.settings)}>
              Add UPI ID
            </button>
          </div>
        </div>
      )}
      {data.ready && data.jobs.length === 0 && (
        <div className={C.empty}>
          Payments belong to a job. Record the job first.
          <button type={C.button} className={C.btn} onClick={() => go(Screen.jobs)}>
            Record a job
          </button>
        </div>
      )}

      {job && (
        <label className={C.fieldLabel}>
          <span className={C.label}>Job</span>
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
