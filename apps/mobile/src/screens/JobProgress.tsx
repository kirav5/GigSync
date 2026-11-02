import { type JobRecord, jobProgress, LOCALE, type ProgressStep, Step, timeText } from "@gigsync/core";
import type { Lang, Payment } from "@gigsync/protocol";
import { Fragment, useState } from "react";
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

/** Folded, the line keeps the first step, the one the job is at and the one after it; the rest open on a tap. */
function keptOpen(steps: readonly ProgressStep[], last: number): ReadonlySet<number> {
  return new Set([0, last, last + 1].filter((i) => i < steps.length));
}

/** Folding one step would save nothing and cost a tap: only runs of at least this many fold. */
const MIN_FOLD = 2;

/** Runs of folded steps, each drawn once as a "3 more steps" row where the first of them would be. */
function foldRuns(count: number, kept: ReadonlySet<number>): Map<number, number> {
  const runs = new Map<number, number>();
  let start = -1;
  for (let i = 0; i <= count; i++) {
    if (i < count && !kept.has(i)) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      if (i - start >= MIN_FOLD) runs.set(start, i - start);
      start = -1;
    }
  }
  return runs;
}

const folds = (runs: ReadonlyMap<number, number>, i: number) =>
  [...runs].some(([start, length]) => i >= start && i < start + length);

/**
 * A signed job's progress, top to bottom, with when each step happened: agreed, on the way, done, paid, closed (or
 * where it was cancelled). Both apps draw the same line from what each phone saw, so the worker and the household
 * agree on where the job is. Folded at first to where it started, where it is and what comes next. Nothing at all
 * before both have signed.
 */
export function JobProgress({ job, payments }: { job: JobRecord; payments: readonly Payment[] }) {
  const { lang, t, plural } = useI18n();
  const [open, setOpen] = useState(false);
  const steps = jobProgress(job, payments);
  if (!steps) return null;
  const now = new Date();
  const last = steps.map((s) => s.reached).lastIndexOf(true);
  const stateOf = (i: number): State => {
    if (steps[i]?.step === Step.cancelled) return State.stopped;
    if (i === last) return State.now;
    return i < last ? State.done : State.next;
  };
  const kept = keptOpen(steps, last);
  const folded = foldRuns(steps.length, kept);
  const runs = open ? new Map<number, number>() : folded;
  return (
    <ol className="job-progress" aria-label={t("progress.title")}>
      {steps.map((s, i) => (
        <Fragment key={s.step}>
          {runs.has(i) && (
            <li className="fold" data-state={i < last ? State.done : State.next}>
              <span className="dot" aria-hidden="true" />
              <button type="button" aria-expanded={false} onClick={() => setOpen(true)}>
                {plural("progress.more", runs.get(i) ?? 0)}
              </button>
            </li>
          )}
          {!folds(runs, i) && (
            <li data-state={stateOf(i)} aria-current={i === last ? "step" : undefined}>
              <span className="dot" aria-hidden="true" />
              <span className="name">{t(`progress.${s.step}`)}</span>
              {s.at && <time dateTime={s.at}>{whenText(lang, s.at, now)}</time>}
            </li>
          )}
        </Fragment>
      ))}
      {open && folded.size > 0 && (
        <li className="fold less">
          <button type="button" aria-expanded={true} onClick={() => setOpen(false)}>
            {t("progress.less")}
          </button>
        </li>
      )}
    </ol>
  );
}
