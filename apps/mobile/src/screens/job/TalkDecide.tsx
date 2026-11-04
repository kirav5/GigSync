import {
  canOffer,
  dayOf,
  type GigDevice,
  type JobRecord,
  localNow,
  phoneOffset,
  TaskKind,
  type TimeAsk,
  theirLast,
  whenPassed,
  whenText,
} from "@gigsync/core";
import { EngagementStatus, EVERY_DAY, Role, type TermWhen, TimeWindow, UPI_MAX_PAISE } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { jobPrice } from "../../ui/places.js";
import type { GigView } from "../../useGig.js";

/**
 * The owner takes the talk over from their agent (ADR 0053 §3–5). After three offers each without agreement: accept
 * theirs, send an offer, or end it. A time the household did not ask for, or one that has passed: take theirs, pick
 * another, or end it. While the agents are still talking, the owner may end the talk or take theirs at any time.
 */

const S = EngagementStatus.enum;
/** A job its agents are still talking about. */
const TALKING: ReadonlySet<EngagementStatus> = new Set([S.sent, S.clarifying, S.negotiating]);
const MS_PER_DAY = 86_400_000;
/** The days a household may pick another time on: today and the next three. */
const DAYS = 4;
const RUPEE = 100;

interface Props {
  job: JobRecord;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  them: string;
}

/**
 * The times still ahead in the next few days, by day then part of the day; for work every day, a part of the day
 * alone, as the job agrees it.
 */
function timesAhead(now: Date, daily: boolean): TermWhen[] {
  if (daily) return TimeWindow.options.map((window) => ({ day: EVERY_DAY, window }));
  const today = localNow(now, phoneOffset(now)).day;
  const days = Array.from({ length: DAYS }, (_, i) =>
    new Date(Date.parse(today) + i * MS_PER_DAY).toISOString().slice(0, 10),
  );
  return days
    .flatMap((day) => TimeWindow.options.map((window) => ({ day, window })))
    .filter((w) => !whenPassed(w, now));
}

/** The decisions about the talk itself, on a job still being talked about. */
export function TalkDecide({ job, view, device, run, them }: Props) {
  const { lang, t } = useI18n();
  const id = job.engagement.id;
  const task = (kind: TaskKind) => view.tasks.find((k) => k.kind === kind && k.engagement === id);
  const time = task(TaskKind.newTime);
  const takeOver = task(TaskKind.takeOver);
  if (time && job.engagement.role === Role.enum.requester)
    return <TimeCard job={job} ask={time.detail as TimeAsk} device={device} run={run} them={them} />;
  if (!TALKING.has(job.engagement.status)) return null;
  // A deal waiting for this owner's signature is signed or declined on its own card, not accepted again here.
  const signing = task(TaskKind.confirmDeal);
  const last = signing ? undefined : theirLast(job);
  const price = last && jobPrice(lang, job.request, last.price_paise);
  return (
    <fieldset className={C.stack} aria-label={t("a11y.takeover")}>
      {takeOver && (
        <>
          <span className={C.label}>{t("decide.takeover_title")}</span>
          {price && <span>{t("decide.takeover_body", { price })}</span>}
        </>
      )}
      {!takeOver && <span className={C.muted}>{t("talks.take_over")}</span>}
      <div className={C.actions}>
        {last && price && (
          <button type={C.button} className={C.accent} onClick={() => void run(() => device.talks.acceptTheirs(id))}>
            {t("decide.accept_theirs", { price })}
          </button>
        )}
        <button type={C.button} className={C.secondary} onClick={() => void run(() => device.talks.end(id))}>
          {t("decide.end")}
        </button>
      </div>
      {!signing && canOffer(job) && <OwnOffer onSend={(paise) => run(() => device.talks.offer(id, paise))} />}
    </fieldset>
  );
}

/** One offer of the owner's own, in whole rupees. */
function OwnOffer({ onSend }: { onSend: (paise: number) => Promise<unknown> }) {
  const { t } = useI18n();
  const [rupees, setRupees] = useState("");
  const amount = Number.parseInt(rupees, 10);
  return (
    <div className={C.row}>
      <input
        className={C.field}
        inputMode="numeric"
        aria-label={t("decide.your_offer")}
        placeholder={t("decide.your_offer")}
        value={rupees}
        onChange={(e) => setRupees(e.target.value.replace(/\D/g, ""))}
      />
      <button
        type={C.button}
        className={C.secondary}
        disabled={!(amount > 0 && amount * RUPEE <= UPI_MAX_PAISE)}
        onClick={() => void onSend(amount * RUPEE).then(() => setRupees(""))}
      >
        {t("decide.send_offer")}
      </button>
    </div>
  );
}

/** The household decides the time: the worker's other one, a time of its own, or no deal. */
function TimeCard({ job, ask, device, run, them }: Omit<Props, "view"> & { ask: TimeAsk }) {
  const { lang, t } = useI18n();
  const id = job.engagement.id;
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<TermWhen>();
  const ahead = timesAhead(new Date(), dayOf(job.request) === EVERY_DAY);
  // A pick whose time went by while the card was open is no pick.
  const chosen = picked && ahead.find((w) => w.day === picked.day && w.window === picked.window);
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
          <button type={C.button} className={C.accent} onClick={() => void run(() => device.talks.acceptTime(id))}>
            {t("decide.accept_time", { when: theirs })}
          </button>
        )}
        <button type={C.button} className={C.secondary} onClick={() => setPicking(true)}>
          {t("decide.pick_time")}
        </button>
        <button type={C.button} className={C.secondary} onClick={() => void run(() => device.talks.end(id))}>
          {t("decide.end")}
        </button>
      </div>
      {picking && (
        <>
          <div className={C.row}>
            {ahead.map((w) => {
              const on = picked?.day === w.day && picked.window === w.window;
              return (
                <button
                  key={`${w.day}-${w.window}`}
                  type={C.button}
                  aria-pressed={on}
                  className={on ? C.chipOn : C.chip}
                  onClick={() => setPicked(w)}
                >
                  {whenText(lang, w)}
                </button>
              );
            })}
          </div>
          {chosen && (
            <button
              type={C.button}
              className={C.accent}
              onClick={() => {
                if (whenPassed(chosen, new Date())) return setPicked(undefined);
                void run(() => device.talks.pickTime(id, chosen));
              }}
            >
              {t("decide.pick_send")}
            </button>
          )}
        </>
      )}
    </fieldset>
  );
}
