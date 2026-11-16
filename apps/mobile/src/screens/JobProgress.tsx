import {
  dayOf,
  EVERY_DAY,
  type JobRecord,
  jobProgress,
  LOCALE,
  type ProgressStep,
  Step,
  timeText,
  WhenDetail,
} from "@gigsync/core";
import { CancelReason, type JobRequest, type Lang, type Payment, Role, StopReason } from "@gigsync/protocol";
import type { ReactNode } from "react";
import { type I18n, useI18n } from "../i18n.js";
import { Icon, type IconName } from "../ui/Icon.js";
import { Said } from "../ui/Said.js";
import { SpeakButton } from "../ui/SpeakButton.js";
import { dayDate } from "./jobGroups.js";
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
/** The drawing beside the status line: what the next move looks like, or how the job ended. */
const ART: Readonly<Record<NextStep, IconName>> = {
  [Step.on_my_way]: "car",
  [Step.started]: "wrench",
  [Step.done]: "tick",
  [Step.paid]: "rupee",
};
const ENDED_ART: IconName = "check";
const STOPPED_ART: IconName = "close";
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

/** The drawing for where the job is: the next move's, or the end it reached. */
function artOf(drawn: readonly ProgressStep[], last: number, stopped: boolean): IconName {
  if (stopped) return STOPPED_ART;
  const next = drawn[last + 1]?.step;
  return next !== undefined && isNextStep(next) ? ART[next] : ENDED_ART;
}

/** The work's day as a card says it: Today, Every day, or "18 Nov". */
export function dayWord(day: string, lang: Lang, t: I18n["t"]): string {
  if (day === EVERY_DAY) return t("when.daily");
  const at = dayDate(day);
  return sameDay(at, new Date()) ? t("schedule.today") : at.toLocaleDateString(LOCALE[lang], DAY_MONTH);
}

/** When the work is, large at the card's end: the time the household asked for, and the day under it. */
function SlotTime({ request, from }: { request: JobRequest; from: Lang | undefined }) {
  const { t, lang } = useI18n();
  const day = dayOf(request);
  const time = request.details[WhenDetail.time];
  const dayText = day === undefined ? undefined : dayWord(day, lang, t);
  if (!time && !dayText) return null;
  return (
    <span className="job-slot">
      {time ? <Said text={time} from={from} /> : dayText}
      {time && dayText && <small>{dayText}</small>}
    </span>
  );
}

interface Props {
  job: JobRecord;
  payments: readonly Payment[];
  /** The other side's name, for "Lakshmi is on the way". */
  them?: string;
  /** The language the request was written in, for its time. */
  from?: Lang | undefined;
  /** The one move on the card: the worker's next step, drawn inside it. */
  children?: ReactNode;
}

/**
 * A signed job's progress as the live card, the same on both apps: dark, so the job happening now is found at once.
 * A drawing of the next move, one big line saying what comes next and a small one saying where the job is and since
 * when, the time of the work large at its end; then Agreed, On the way, Started, Done and Paid as a bar of segments
 * with their names under it; then the move (`children`) and a speaker. A cancelled job ends on a red segment where it
 * stopped; a closed one says so in the line. Nothing at all before both have signed.
 */
export function JobProgress({ job, payments, them, from, children }: Props) {
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
  const big = said ?? t(`progress.${current?.step ?? Step.agreed}`);
  return (
    <div className="job-progress" data-state={stopped ? State.stopped : State.now} data-live={live || undefined}>
      {current && (
        <div className="job-status" data-state={stopped ? State.stopped : State.now}>
          <span className="job-status-art" aria-hidden="true">
            <Icon name={artOf(drawn, last, stopped)} size={26} />
          </span>
          {/* What comes next is the big line; where the job is, and since when, the small one under it. */}
          <p className="job-progress-status">
            <strong>{big}</strong>
            <span className="aside">
              {said && t(`progress.${current.step}`)}
              {said && current.at && DOT}
              {current.at && <time dateTime={current.at}>{longWhen(lang, current.at, now)}</time>}
            </span>
          </p>
          <SlotTime request={job.request} from={from} />
        </div>
      )}
      {/* The steps as a bar, a segment each with its name under it; their times are read out, and listed under More. */}
      <ol className="job-steps" aria-label={t("progress.title")} data-live={live || undefined}>
        {drawn.map((s, i) => {
          const state = stateOf(s, i, last);
          return (
            <li key={s.step} data-state={state} aria-current={i === last ? "step" : undefined}>
              <span className="step-name" aria-hidden="true">
                {t(`progress.${s.step}`)}
              </span>
              <span className="sr">
                {t(`progress.${s.step}`)}, {t(`progress.state.${state}`)}
                {s.reached && s.at && (
                  <>
                    {DOT}
                    <time dateTime={s.at}>{shortWhen(lang, s.at, now)}</time>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="job-live-foot">
        {children}
        <SpeakButton lang={lang} text={big} />
      </div>
    </div>
  );
}

/** Each step the job reached, with when this phone saw it: the times the bar leaves out, listed under More. */
export function StepTimes({ job, payments }: { job: JobRecord; payments: readonly Payment[] }) {
  const { lang, t } = useI18n();
  const steps = jobProgress(job, payments)?.filter((s) => s.reached && s.at !== undefined);
  if (!steps || steps.length === 0) return null;
  const now = new Date();
  return (
    <ul className="step-times" aria-label={t("job.times")}>
      {steps.map((s) => (
        <li key={s.step}>
          <span>{t(`progress.${s.step}`)}</span>
          {s.at && <time dateTime={s.at}>{longWhen(lang, s.at, now)}</time>}
        </li>
      ))}
    </ul>
  );
}
