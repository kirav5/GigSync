import { PaymentBook, type Ports } from "@gigsync/core";
import type { Engagement, UserId } from "@gigsync/protocol";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { GetPaid } from "./GetPaid.js";
import { jobLabel, loadPayee, type Payee, recordJob, savePayee, selfId, workerJobs } from "./store.js";

/** Names and UPI IDs are typed fresh; the browser must not suggest other people's. */
const NO_AUTOFILL = "off";

/** The worker's side of payments: her UPI ID once, her jobs, and getting paid for the chosen one. */
export function PaymentsPanel({ ports }: { ports: Ports }) {
  const book = useMemo(() => new PaymentBook(ports.storage, ports.clock), [ports]);
  const [self, setSelf] = useState<UserId>();
  const [payee, setPayee] = useState<Payee>();
  const [editingPayee, setEditingPayee] = useState(false);
  const [jobs, setJobs] = useState<Engagement[]>([]);
  const [jobId, setJobId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void (async () => {
      setSelf(await selfId(ports.storage));
      const saved = await loadPayee(ports.storage);
      setPayee(saved);
      setEditingPayee(!saved);
      const list = await workerJobs(ports.storage);
      setJobs(list);
      setJobId(list[0]?.id);
    })();
  }, [ports]);

  async function onSavePayee(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next = { vpa: String(form.get("vpa") ?? ""), name: String(form.get("name") ?? "") };
    try {
      await savePayee(ports.storage, next);
      setPayee(await loadPayee(ports.storage));
      setEditingPayee(false);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onNewJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const consumer = String(form.get("consumer") ?? "").trim();
    const work = String(form.get("work") ?? "").trim();
    if (!consumer || !work) return setError("Enter the customer's name and the work.");
    const job = await recordJob(ports.storage, { consumer, work }, ports.clock.now());
    setJobs((list) => [job, ...list]);
    setJobId(job.id);
    setError(undefined);
    formEl.reset();
  }

  const job = jobs.find((j) => j.id === jobId);

  return (
    <div className="log payments-panel">
      {editingPayee || !payee ? (
        <form className="pay-form" onSubmit={(e) => void onSavePayee(e)}>
          <strong>Your UPI ID</strong>
          <small>Kept only on this phone. Customers pay you directly; GigSync never touches the money.</small>
          <input name="vpa" placeholder="name@bank" defaultValue={payee?.vpa} autoComplete={NO_AUTOFILL} />
          <input name="name" placeholder="Your name as customers see it" defaultValue={payee?.name} />
          <button type="submit">Save</button>
        </form>
      ) : (
        <p className="hint">
          Paid to <strong>{payee.vpa}</strong>{" "}
          <button type="button" className="link" onClick={() => setEditingPayee(true)}>
            change
          </button>
        </p>
      )}

      <form className="pay-form" onSubmit={(e) => void onNewJob(e)}>
        <strong>Record a job</strong>
        <input name="consumer" placeholder="Customer's name" autoComplete={NO_AUTOFILL} />
        <input name="work" placeholder="Work, e.g. house cleaning Mon–Fri" autoComplete={NO_AUTOFILL} />
        <button type="submit">Add job</button>
      </form>

      {jobs.length > 0 && (
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Job">
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {jobLabel(j)}
            </option>
          ))}
        </select>
      )}
      {error && <p className="error">{error}</p>}
      {job && payee && self && <GetPaid book={book} job={job} payee={payee} self={self} />}
    </div>
  );
}
