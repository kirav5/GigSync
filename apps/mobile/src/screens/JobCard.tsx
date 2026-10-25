import type { Engagement, Payment } from "@gigsync/protocol";
import { consumerName, JobMove, JobStep, jobStep } from "../payments/store.js";
import { C } from "../ui/cls.js";

const STEPS = ["Agreed", "Working", "Done", "Paid"] as const;
const STEP_TAG: Readonly<Record<JobStep, { text: string; cls: string }>> = {
  [JobStep.agreed]: { text: "Agreed", cls: "tag talk" },
  [JobStep.working]: { text: "Working", cls: "tag talk" },
  [JobStep.done]: { text: "Payment due", cls: "tag wait" },
  [JobStep.paid]: { text: "Paid", cls: "tag fresh" },
};

interface Props {
  job: Engagement;
  payments: readonly Payment[];
  onMove?: (job: Engagement, move: JobMove) => void;
  onPay?: (job: Engagement) => void;
}

/** Summary-first, as Collab's cards: who · progress · one status · at most two actions. */
export function JobCard({ job, payments, onMove, onPay }: Props) {
  const step = jobStep(job, payments);
  const tag = STEP_TAG[step];
  const name = consumerName(job);
  return (
    <article className={step === JobStep.done ? C.cardWait : C.card}>
      <div className={C.row}>
        <span className="avatar" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="who">
          <strong>{name}</strong>
          <span className={C.muted}>{job.brief.text}</span>
        </div>
        <span className={`${tag.cls} end`}>{tag.text}</span>
      </div>
      <ol className="steps" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? "done" : i === step ? "now" : undefined}>
            {s}
          </li>
        ))}
      </ol>
      {(onMove || onPay) && step !== JobStep.paid && (
        <div className={C.row}>
          {onMove && step === JobStep.agreed && (
            <button type={C.button} className={C.secondary} onClick={() => onMove(job, JobMove.start)}>
              Start work
            </button>
          )}
          {onMove && step === JobStep.working && (
            <button type={C.button} className={C.secondary} onClick={() => onMove(job, JobMove.done)}>
              Mark done
            </button>
          )}
          {onPay && (
            <button type={C.button} className={C.accent} onClick={() => onPay(job)}>
              Get paid
            </button>
          )}
        </div>
      )}
    </article>
  );
}
