import { rupees, summarize } from "@gigsync/core";
import { PaymentRow } from "../payments/PaymentRow.js";
import { jobLabel } from "../payments/store.js";
import type { GigData } from "../state.js";
import { C } from "../ui/cls.js";

/** Their working record: every job and payment, kept on this phone, for a union, helpline or welfare board. */
export function Record({ data }: { data: GigData }) {
  const sum = summarize(data.payments);
  const label = new Map(data.jobs.map((j) => [j.id, jobLabel(j)]));
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>My record</span>
        <h1 className={C.headline}>
          Your work. <span className={C.soft}>Your proof.</span>
        </h1>
        <p className={C.muted}>Kept only on this phone. When something goes wrong, you choose who sees which part.</p>
      </div>

      <div className="stats">
        <div>
          <span className={C.label}>Jobs</span>
          <b>{data.jobs.length}</b>
        </div>
        <div>
          <span className={C.label}>Received</span>
          <b className={C.money}>₹{rupees(sum.confirmed)}</b>
        </div>
        <div>
          <span className={C.label}>Waiting</span>
          <b className={C.money}>₹{rupees(sum.outstanding)}</b>
        </div>
      </div>

      {data.ready && data.payments.length === 0 && <div className={C.empty}>No payments recorded yet.</div>}
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
