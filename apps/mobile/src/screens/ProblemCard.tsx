import { canReport, type GigDevice, type JobRecord, ProblemBy } from "@gigsync/core";
import { PROBLEM_HOLD_DAYS, PROBLEM_NOTE_MAX, ProblemReason } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { useI18n } from "../i18n.js";
import { useStep } from "../payments/useStep.js";
import { BusyGroup } from "../ui/BusyGroup.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";
import { Said } from "../ui/Said.js";
import { useBusy } from "../ui/useBusy.js";
import { J } from "./job/look.js";

/** The form's field names. */
const F = { reason: "reason", text: "text" } as const;

interface Props {
  job: JobRecord;
  /** The other side's name as the card shows it. */
  them: string;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
}

/**
 * "Report a problem" on a signed job whose contacts are still here (ADR 0039 §3): a reason from the list and a few
 * words if the owner likes. While it is open both phones keep the contacts, at most 30 days, and either side may mark
 * it resolved.
 */
export function ProblemCard({ job, them, device, run }: Props) {
  const { t } = useI18n();
  const { busy, guard } = useBusy();
  const { step, error } = useStep((work) => guard(() => run(work)));
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<ProblemReason>(ProblemReason.enum.not_paid);
  const id = job.engagement.id;
  const problem = job.problem;

  if (problem && !problem.resolved_at && !job.contacts_removed_at) {
    const reason = t(`problem.reason.${problem.reason}`);
    const title =
      problem.by === ProblemBy.me
        ? t("problem.open_mine", { reason })
        : t("problem.open_theirs", { name: them, reason });
    return (
      <section className={C.cardWait} aria-label={t("problem.report")}>
        <strong>{title}</strong>
        {problem.text && <Said text={problem.text} from={problem.lang} />}
        <span className={C.muted}>{t("problem.holds", { days: PROBLEM_HOLD_DAYS })}</span>
        {!problem.told && <span className={C.faint}>{t("problem.not_told")}</span>}
        <BusyGroup busy={busy}>
          <div className={C.actions}>
            <button type={C.button} className={C.secondary} onClick={() => step(() => device.contacts.resolve(id))}>
              {t("problem.resolve")}
            </button>
          </div>
        </BusyGroup>
        {error && <p className={C.error}>{error}</p>}
      </section>
    );
  }
  if (problem?.resolved_at && !job.contacts_removed_at) return <p className={C.faint}>{t("problem.resolved")}</p>;
  if (!canReport(job, new Date())) return null;
  if (!open)
    return (
      <button type={C.button} className={J.ghost} onClick={() => setOpen(true)}>
        <Icon name="flag" />
        {t("problem.report")}
      </button>
    );

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get(F.text) ?? "").trim();
    // A report that failed leaves the form open, to try again.
    const report = { reason: picked, ...(text ? { text } : {}) };
    step(
      () => device.contacts.report(id, report),
      () => setOpen(false),
    );
  }
  const title = t("problem.title");
  return (
    <form className={C.cardWait} onSubmit={submit} aria-label={title}>
      <span className={C.label}>{title}</span>
      <BusyGroup busy={busy}>
        <fieldset className={C.actions} aria-label={title}>
          {ProblemReason.options.map((r) => (
            <label key={r} className={picked === r ? C.chipOn : C.chip}>
              <input type="radio" name={F.reason} value={r} checked={picked === r} onChange={() => setPicked(r)} />
              {t(`problem.reason.${r}`)}
            </label>
          ))}
        </fieldset>
        <input
          className={C.field}
          name={F.text}
          maxLength={PROBLEM_NOTE_MAX}
          aria-label={t("problem.words")}
          placeholder={t("problem.words")}
        />
        <div className={C.actions}>
          <button type={C.submit} className={C.accent}>
            {t("problem.send")}
          </button>
          <button type={C.button} className={C.secondary} onClick={() => setOpen(false)}>
            {t("problem.cancel")}
          </button>
        </div>
      </BusyGroup>
      {error && <p className={C.error}>{error}</p>}
    </form>
  );
}
