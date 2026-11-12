import { type JobRecord, jobProgress, LOCALE, type ProgressStep, Step, timeText } from "@gigsync/core";
import { CancelReason, type Lang, type Payment, Role, StopReason } from "@gigsync/protocol";
import { type I18n, useI18n } from "../i18n.js";
import { Icon } from "../ui/Icon.js";
import "./progress.css";

/** A step's look: passed, the one the job is at now, still ahead, or where a cancelled job stopped. */
const State = { done: "done", now: "now", next: "next", stopped: "stopped" } as const;
type State = (typeof State)[keyof typeof State];

/** Whose words say what comes next: the worker makes the moves, the household watches them and pays. */
const Side = { worker: "worker", household: "household" } as const;

/** The steps the status line can name as coming next; Agreed is always behind, and nothing follows Paid. */
type NextStep = typeof Step.on_my_way | typeof Step.started | typeof Step.done | typeof Step.paid;
const NEXT_STEPS: ReadonlySet<Step> = new Set<NextStep>([Step.on_my_way, Step.started, Step.done, Step.paid]);
const isNextStep = (step: Step): step is NextStep => NEXT_STEPS.has(step);

const DOT = " · ";
const DAY_MONTH: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "8:02 am" today, "31 Oct" on another day: short enough to sit under a step. */
function shortWhen(lang: Lang, at: string, now: Date): string {
  const when = new Date(at);
  return sameDay(when, now) ? timeText(lang, when) : when.toLocaleDateString(LOCALE[lang], DAY_MONTH);
}

/** "8:02 am" today, "31 Oct, 8:02 am" on another day: the status line has room for both. */
function longWhen(lang: Lang, at: string, now: Date): string {
  const when = new Date(at);
  const time = timeText(lang, when);
  return sameDay(when, now) ? time : `${when.toLocaleDateString(LOCALE[lang], DAY_MONTH)}, ${time}`;
}

const reached = (steps: readonly ProgressStep[], step: Step) => steps.some((s) => s.step === step && s.reached);

/**
 * The steps drawn as nodes. Closed is said in the status line, not drawn. Core lists Started only once the worker sent
 * it; a live job that has not reached Done shows it ahead anyway, so the worker sees what comes next. A job past Done
 * (or cancelled) is never given a Started it may not have had.
 */
function drawnSteps(steps: readonly ProgressStep[]): ProgressStep[] {
  const drawn = steps.filter((s) => s.step !== Step.closed);
  const cancelled = steps.some((s) => s.step === Step.cancelled);
  if (cancelled || reached(steps, Step.done) || drawn.some((s) => s.step === Step.started)) return drawn;
  const after = drawn.findIndex((s) => s.step === Step.on_my_way) + 1;
  return [...drawn.slice(0, after), { step: Step.started, reached: false }, ...drawn.slice(after)];
}

function stateOf(s: ProgressStep, i: number, last: number): State {
  if (s.step === Step.cancelled) return State.stopped;
  if (i === last) return State.now;
  return s.reached ? State.done : State.next;
}

/** Why a cancelled job stopped, when it says more than "cancelled": the worker's stop reason, or the cancel's own. */
function whyStopped(job: JobRecord, t: I18n["t"]): string | undefined {
  const stop = job.cancel?.stop;
  if (stop && stop !== StopReason.enum.other) return t(`stop.${stop}`);
  const reason = job.cancel?.reason;
  return reason && reason !== CancelReason.enum.other ? t(`cancel.${reason}`) : undefined;
}

/** The status line's muted half: where a cancelled job stopped and why, or the one move that comes next. */
function aside(job: JobRecord, drawn: readonly ProgressStep[], last: number, name: string, t: I18n["t"]) {
  if (drawn[last]?.step === Step.cancelled) {
    const before = drawn[last - 1];
    const where = before && t("progress.stopped_at", { step: t(`progress.${before.step}`) });
    const said = [where, whyStopped(job, t)].filter((part) => part !== undefined);
    return said.length > 0 ? said.join(DOT) : undefined;
  }
  const next = drawn[last + 1]?.step;
  if (next === undefined || !isNextStep(next)) return undefined;
  const side = job.engagement.role === Role.enum.provider ? Side.worker : Side.household;
  return t(`progress.next_${side}.${next}`, { name });
}

/**
 * A signed job's progress, left to right, the same on both apps: a plain line saying where the job is and what comes
 * next, then Agreed, On the way, Started, Done and Paid as nodes on a track, each reached one with when this phone saw
 * it. A cancelled job ends on a red node where it stopped; a closed one says so in the line. Nothing at all before
 * both have signed. `them` is the other side's name, for "Next: Lakshmi starts work".
 */
export function JobProgress({ job, payments, them }: { job: JobRecord; payments: readonly Payment[]; them?: string }) {
  const { lang, t } = useI18n();
  const steps = jobProgress(job, payments);
  if (!steps) return null;
  const drawn = drawnSteps(steps);
  const last = drawn.map((s) => s.reached).lastIndexOf(true);
  const closed = steps.find((s) => s.step === Step.closed && s.reached);
  const current = closed ?? drawn[last];
  const worker = job.engagement.role === Role.enum.provider;
  const name = them ?? job.contact?.name ?? job.their_name ?? t(worker ? "job.customer" : "job.worker");
  const said = closed ? undefined : aside(job, drawn, last, name, t);
  const stopped = current?.step === Step.cancelled;
  // The halo pulses only while the job is still moving: a closed, cancelled or fully paid job sits still.
  const live = !stopped && said !== undefined;
  const now = new Date();
  return (
    <div className="job-progress">
      {current && (
        <p className="job-progress-status" data-state={stopped ? State.stopped : State.now}>
          <strong>{t(`progress.${current.step}`)}</strong>
          {current.at && (
            <>
              {DOT}
              <time dateTime={current.at}>{longWhen(lang, current.at, now)}</time>
            </>
          )}
          {said && <span className="aside">{said}</span>}
        </p>
      )}
      <ol className="job-steps" aria-label={t("progress.title")} data-live={live || undefined}>
        {drawn.map((s, i) => {
          const state = stateOf(s, i, last);
          return (
            <li key={s.step} data-state={state} aria-current={i === last ? "step" : undefined}>
              <span className="node" aria-hidden="true">
                {state === State.done && <Icon name="tick" />}
                {state === State.stopped && <Icon name="close" />}
                {state === State.next && i + 1}
              </span>
              <span className="name">{t(`progress.${s.step}`)}</span>
              <span className="sr">{t(`progress.state.${state}`)}</span>
              {s.reached && s.at && <time dateTime={s.at}>{shortWhen(lang, s.at, now)}</time>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
