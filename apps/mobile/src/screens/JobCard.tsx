import type { MessageKey } from "@gigsync/core";
import type { Engagement, Payment } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import { consumerName, JobMove, JobStep, jobStep } from "../payments/store.js";
import { C } from "../ui/cls.js";

const STEPS: readonly MessageKey[] = ["step.agreed", "step.working", "step.done", "step.paid"];
const STEP_TAG: Readonly<Record<JobStep, { text: MessageKey; cls: string }>> = {
  [JobStep.agreed]: { text: "step.agreed", cls: "tag talk" },
  [JobStep.working]: { text: "step.working", cls: "tag talk" },
  [JobStep.done]: { text: "step.due", cls: "tag wait" },
  [JobStep.paid]: { text: "step.paid", cls: "tag fresh" },
};

interface Props {
  job: Engagement;
  payments: readonly Payment[];
  onMove?: (job: Engagement, move: JobMove) => void;
  onPay?: (job: Engagement) => void;
}

/** Summary-first, as Collab's cards: who · progress · one status · at most two actions. */
export function JobCard({ job, payments, onMove, onPay }: Props) {
  const { t } = useI18n();
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
        <span className={`${tag.cls} end`}>{t(tag.text)}</span>
      </div>
      <ol className="steps" aria-label={t("step.of", { step: step + 1, total: STEPS.length })}>
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? "done" : i === step ? "now" : undefined}>
            {t(s)}
          </li>
        ))}
      </ol>
      {(onMove || onPay) && step !== JobStep.paid && (
        <div className={C.row}>
          {onMove && step === JobStep.agreed && (
            <button type={C.button} className={C.secondary} onClick={() => onMove(job, JobMove.start)}>
              {t("jobcard.start")}
            </button>
          )}
          {onMove && step === JobStep.working && (
            <button type={C.button} className={C.secondary} onClick={() => onMove(job, JobMove.done)}>
              {t("job.mark_done")}
            </button>
          )}
          {onPay && (
            <button type={C.button} className={C.accent} onClick={() => onPay(job)}>
              {t("nav.pay")}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
