import {
  atHour,
  dayOf,
  FIRST_HOUR,
  type GigDevice,
  hourText,
  type JobRecord,
  LAST_HOUR,
  localNow,
  phoneOffset,
  range,
  sameTerm,
  type TimeAsk,
  whenPassed,
  whenText,
} from "@gigsync/core";
import { EVERY_DAY, TermKey, type TermWhen, TimeWindow } from "@gigsync/protocol";
import { useState } from "react";
import { dayLabel } from "../../find/ask.js";
import { useI18n } from "../../i18n.js";
import type { Step } from "../../payments/useStep.js";
import { C } from "../../ui/cls.js";

const MS_PER_DAY = 86_400_000;
/** The days a household may pick another time on: today and the next three. */
const DAYS = 4;
/** Length of "YYYY-MM-DD" at the start of an ISO timestamp. */
const ISO_DAY_LENGTH = 10;

interface Props {
  job: JobRecord;
  ask: TimeAsk;
  device: GigDevice;
  step: Step;
  them: string;
}

/** What the household picks a time from: the days offered and the one picked, the times on it, whether work is daily. */
interface Choices {
  daily: boolean;
  days: string[];
  onDay?: string | undefined;
  ahead: TermWhen[];
}

/** Today and the next few days on the phone's calendar. */
function nextDays(now: Date): string[] {
  const today = localNow(now, phoneOffset(now)).day;
  return range(0, DAYS - 1).map((i) =>
    new Date(Date.parse(today) + i * MS_PER_DAY).toISOString().slice(0, ISO_DAY_LENGTH),
  );
}

/** The start hours still ahead on a day (ADR 0053 §1–2): the hours Find offers, none that has come. */
const hoursAhead = (day: string, now: Date): TermWhen[] =>
  range(FIRST_HOUR, LAST_HOUR)
    .map((h) => atHour(day, h))
    .filter((w) => !whenPassed(w, now));

/**
 * The parts of the day still ahead in the next few days, for a job with a phone that does not understand hours; for
 * work every day, a part of the day alone, as the job agrees it.
 */
function partsAhead(now: Date, daily: boolean): TermWhen[] {
  if (daily) return TimeWindow.options.map((window) => ({ day: EVERY_DAY, window }));
  return nextDays(now)
    .flatMap((day) => TimeWindow.options.map((window) => ({ day, window })))
    .filter((w) => !whenPassed(w, now));
}

/** A chip the household taps to pick something; pressed while picked. */
function Pick({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type={C.button} aria-pressed={on} className={on ? C.chipOn : C.chip} onClick={onClick}>
      {label}
    </button>
  );
}

/**
 * The times the household may pick from `now`: between phones that understand hours, the days with a start hour still
 * ahead and the hours on the day picked (for work every day, the hours alone); else the parts of the day.
 */
function choices(job: JobRecord, day: string | undefined, now: Date): Choices {
  const daily = dayOf(job.request) === EVERY_DAY;
  if (job.terms?.hours !== true) return { daily, days: [], ahead: partsAhead(now, daily) };
  if (daily) return { daily, days: [], ahead: hoursAhead(EVERY_DAY, now) };
  const days = nextDays(now).filter((d) => hoursAhead(d, now).length > 0);
  const onDay = day && days.includes(day) ? day : undefined;
  return { daily, days, onDay, ahead: onDay ? hoursAhead(onDay, now) : [] };
}

/** The household's own time: a day, then a time on it, then send. */
function TimePicker({ job, onSend }: { job: JobRecord; onSend: (when: TermWhen) => void }) {
  const i18n = useI18n();
  const { lang, t } = i18n;
  const [day, setDay] = useState<string>();
  const [picked, setPicked] = useState<TermWhen>();
  const { daily, days, onDay, ahead } = choices(job, day, new Date());
  // A pick whose time went by while the card was open is no pick.
  const chosen = picked && ahead.find((w) => sameTerm(TermKey.enum.when, w, picked));
  return (
    <>
      {days.length > 0 && (
        <>
          <span className={C.muted}>{t("decide.pick_day")}</span>
          <div className={C.row}>
            {days.map((d) => (
              <Pick key={d} on={d === onDay} label={dayLabel(i18n, d)} onClick={() => setDay(d)} />
            ))}
          </div>
        </>
      )}
      <div className={C.row}>
        {ahead.map((w) => (
          <Pick
            key={`${w.day}-${w.window}-${w.hour ?? ""}`}
            on={sameTerm(TermKey.enum.when, w, picked)}
            label={w.hour !== undefined && !daily ? hourText(lang, w.hour) : whenText(lang, w)}
            onClick={() => setPicked(w)}
          />
        ))}
      </div>
      {chosen && (
        <button
          type={C.button}
          className={C.accent}
          onClick={() => (whenPassed(chosen, new Date()) ? setPicked(undefined) : onSend(chosen))}
        >
          {t("decide.pick_send")}
        </button>
      )}
    </>
  );
}

/**
 * The household decides the time (ADR 0053 §3): the worker's other one, a time of its own, or no deal. Between phones
 * that understand hours, a day and then a start hour (for work every day, the hour alone); else a part of the day.
 */
export function TimeCard({ job, ask, device, step, them }: Props) {
  const { lang, t } = useI18n();
  const id = job.engagement.id;
  const [picking, setPicking] = useState(false);
  const theirs = ask.when && whenText(lang, ask.when);
  const line = ask.passed
    ? theirs
      ? t("decide.time_passed_other", { name: them, when: theirs })
      : t("decide.time_passed")
    : t("decide.time_other", { name: them, when: theirs ?? "" });
  return (
    <fieldset className={C.stack} aria-label={t("a11y.new_time")}>
      <span className={C.label}>{t("decide.time_title")}</span>
      <span>{line}</span>
      <div className={C.actions}>
        {theirs && (
          <button type={C.button} className={C.accent} onClick={() => step(() => device.talks.acceptTime(id))}>
            {t("decide.accept_time", { when: theirs })}
          </button>
        )}
        <button type={C.button} className={C.secondary} onClick={() => setPicking(true)}>
          {t("decide.pick_time")}
        </button>
        <button type={C.button} className={C.secondary} onClick={() => step(() => device.talks.end(id))}>
          {t("decide.end")}
        </button>
      </div>
      {picking && <TimePicker job={job} onSend={(when) => step(() => device.talks.pickTime(id, when))} />}
    </fieldset>
  );
}
