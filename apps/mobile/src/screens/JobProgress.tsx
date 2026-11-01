import { type JobRecord, jobProgress, LOCALE, Step, timeText } from "@gigsync/core";
import type { Lang, Payment } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import "./progress.css";

/** A step's look: passed, the one the job is at now, still ahead, or where a cancelled job stopped. */
const State = { done: "done", now: "now", next: "next", stopped: "stopped" } as const;
type State = (typeof State)[keyof typeof State];

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/** "7:03 pm" today, "31 Oct, 7:03 pm" on another day: when a step happened, in the owner's own words. */
function whenText(lang: Lang, at: string, now: Date): string {
  const when = new Date(at);
  const time = timeText(lang, when);
  if (when.toDateString() === now.toDateString()) return time;
  return `${when.toLocaleDateString(LOCALE[lang], DAY_MONTH)}, ${time}`;
}

/**
 * A signed job's progress as a line of steps with their times: agreed, on the way, done, paid, closed (or where it
 * was cancelled). Both apps draw the same line from what each phone saw, so the worker and the household agree on
 * where the job is. Nothing at all before both have signed.
 */
export function JobProgress({ job, payments }: { job: JobRecord; payments: readonly Payment[] }) {
  const { lang, t } = useI18n();
  const steps = jobProgress(job, payments);
  if (!steps) return null;
  const now = new Date();
  const last = steps.map((s) => s.reached).lastIndexOf(true);
  const stateOf = (i: number): State => {
    if (steps[i]?.step === Step.cancelled) return State.stopped;
    if (i === last) return State.now;
    return i < last ? State.done : State.next;
  };
  return (
    <ol className="job-progress" aria-label={t("progress.title")} style={{ "--steps": steps.length } as never}>
      {steps.map((s, i) => (
        <li key={s.step} data-state={stateOf(i)} aria-current={i === last ? "step" : undefined}>
          <span className="dot" aria-hidden="true" />
          <span className="name">{t(`progress.${s.step}`)}</span>
          {s.at && <time dateTime={s.at}>{whenText(lang, s.at, now)}</time>}
        </li>
      ))}
    </ol>
  );
}
