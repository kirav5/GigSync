import {
  bothSigned,
  dayOf,
  EVERY_DAY,
  FINISHED_WORK,
  type JobRecord,
  NUMBER_ONLY,
  t as say,
  timeText,
  WhenDetail,
} from "@gigsync/core";
import { EngagementStatus, type JobRequest, type Lang, QuestionKey, Role } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";
import { Said } from "../ui/Said.js";
import { AgentTalk } from "./AgentTalk.js";
import { DetailValue } from "./DetailValue.js";
import { type JobActionProps, JobActions } from "./JobActions.js";
import { PlanCard } from "./JobDecide.js";
import { JobProgress } from "./JobProgress.js";
import { RemovedLine, RestoredLine } from "./JobSettled.js";
import { dayDate } from "./jobGroups.js";
import { IntroActions } from "./mentor/IntroActions.js";
import { ProblemCard } from "./ProblemCard.js";
import { RestoredActions } from "./RestoredActions.js";
import { TermsList } from "./terms/TermsList.js";
import "./jobs.css";

const S = EngagementStatus.enum;
const TALK = "tag talk";
const WAIT = "tag wait";
const FRESH = "tag fresh";
const DANGER = "tag danger";

/** How each status looks; its words come from the owner's language (`status.<name>`). */
const TAG: Readonly<Record<EngagementStatus, string>> = {
  [S.draft]: TALK,
  [S.sent]: TALK,
  [S.clarifying]: WAIT,
  [S.responded]: TALK,
  [S.negotiating]: TALK,
  [S.confirming]: WAIT,
  [S.agreed]: FRESH,
  [S.in_progress]: FRESH,
  [S.delivered]: FRESH,
  [S.revision]: WAIT,
  [S.closed]: FRESH,
  [S.declined]: DANGER,
  [S.expired]: DANGER,
  [S.cancelled]: DANGER,
};

/** The When details have their own line; the generic list leaves them out. */
const WHEN_KEYS: ReadonlySet<string> = new Set(Object.values(WhenDetail));

/**
 * One job as this owner sees it, decisions near the top: who, what, the deal and when, then the actions, the contact,
 * notes and the money. What the agents said on the way (the request's details, the plan, the offers) is folded away.
 */
export function JobThread(props: JobActionProps) {
  const { job, view, device, run } = props;
  const { lang, t } = useI18n();
  const e = job.engagement;
  const isWorker = e.role === Role.enum.provider;
  const them =
    view.names[e.counterpart] || job.contact?.name || job.their_name || t(isWorker ? "job.customer" : "job.worker");
  const terms = job.mine?.terms;
  const payments = view.payments.filter((p) => p.engagement === e.id);
  const notes = job.notes ?? [];
  // The consumer's free text (need, when, typed answers, review) is in the language their request says.
  const theirs = isWorker ? job.request.lang : undefined;
  // The signed slot is a copy of the request's `when`; with a structured day, the When line below says it in this
  // phone's own words, so the slot's machine-translated copy is left out. Older requests have only the slot.
  const slot = terms && dayOf(job.request) === undefined ? terms.slot : undefined;
  // Finished work both signed makes them someone this owner knows: a worker may ask the household whether they know
  // someone in a new city, and a household may introduce the worker who did the job.
  // A name kept after the card was removed still counts: an introduction needs no phone number.
  const knownName = job.contact?.name ?? job.their_name;
  const known = knownName && bothSigned(job) && FINISHED_WORK.has(e.status) ? knownName : undefined;
  // The request's words, unless they only repeat the trade or are a bare count (older requests used the first answer).
  const need = job.request.need.trim();
  const tradeName = say(job.request.lang, `trade.${job.request.trade}`);
  const needShown = need && need !== tradeName && !NUMBER_ONLY.test(need) ? need : "";

  return (
    <article className={C.card} aria-label={t("a11y.job_with", { name: them })} data-status={e.status} lang={lang}>
      <div className={C.row}>
        <span className="avatar" aria-hidden="true">
          {them.slice(0, 1).toUpperCase()}
        </span>
        <div className="who">
          <strong>{them}</strong>
          <span className={C.muted}>{t(`trade.${job.request.trade}`)}</span>
        </div>
        <span className={`${TAG[e.status]} end`}>{t(`status.${e.status}`)}</span>
      </div>
      <JobProgress job={job} payments={payments} />
      {needShown && <Said text={needShown} from={theirs} />}
      {terms && (
        <fieldset aria-label={t("a11y.deal")}>
          {t("job.signed", { price: money(terms.price_paise) })} ·{" "}
          {slot && (
            <>
              <Said text={slot} from={theirs} /> ·{" "}
            </>
          )}
          {t(job.theirs ? "job.both_signed" : "job.their_signature")}
          <TermsList terms={terms.terms} />
        </fieldset>
      )}
      <When request={job.request} from={theirs} />
      <RestoredLine job={job} />

      {/* A restored job's messages never reached the server, so its thread cannot go on: it ends through the record. */}
      {job.restored ? (
        <RestoredActions job={job} device={device} run={run} them={them} />
      ) : (
        <JobActions {...props} them={them} />
      )}

      {job.contact && (
        <fieldset className="contact" aria-label={t("a11y.contact")}>
          <span className={C.label}>{t("job.contact")}</span>
          <strong>{job.contact.name}</strong>
          <span>{job.contact.phone}</span>
          {job.contact.address && <span>{job.contact.address}</span>}
        </fieldset>
      )}
      {known && (
        <IntroActions
          device={device}
          person={{ user: e.counterpart, name: known }}
          run={run}
          ask={isWorker}
          introduce={!isWorker}
        />
      )}
      <RemovedLine job={job} />
      <ProblemCard job={job} them={them} device={device} run={run} />
      {notes.length > 0 && (
        <ul className={C.stack} aria-label={t("a11y.notes")}>
          {notes.map((n, i) => (
            // Notes have no id; the list only grows, so the position is stable.
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
            <li key={i} className="note">
              {n.mine && <span className={C.faint}>{t("progress.you")}: </span>}
              {n.code ? (
                <b>{t(`update.${n.code}`)}</b>
              ) : (
                <b>
                  <Said text={n.text} from={n.lang} />
                </b>
              )}
              {n.at && <time dateTime={n.at}>{timeText(lang, new Date(n.at))}</time>}
            </li>
          ))}
        </ul>
      )}
      {job.cancel && <p className={C.error}>{t(`cancel.${job.cancel.reason}`)}</p>}
      {payments.map((p) => (
        <fieldset key={p.id} aria-label={t("a11y.payment")}>
          {t("job.payment", { price: money(p.amount_paise), status: t(`pay.thread.${p.status}`) })}
          {p.utr ? ` · ${t("job.utr", { utr: p.utr })}` : ""}
        </fieldset>
      ))}
      {job.review && (
        <fieldset aria-label={t("a11y.review")}>
          {"★".repeat(job.review.stars)} <Said text={job.review.text} from={theirs} />
        </fieldset>
      )}

      <AgentTalk job={job} them={them} from={theirs} device={device} />
      <More job={job} from={theirs} />
    </article>
  );
}

/**
 * Folded under Details: the request's details (the When ones have their own line) and the worker's private price
 * plan. Nothing at all when there is neither. The offers are in the agents' talk above.
 */
function More({ job, from }: { job: JobRecord; from: Lang | undefined }) {
  const { t } = useI18n();
  const details = Object.entries(job.request.details).filter(([k]) => !WHEN_KEYS.has(k));
  const plan = job.engagement.role === Role.enum.provider ? job.advice : undefined;
  if (details.length === 0 && !plan) return null;

  return (
    <details className="job-more">
      <summary>{t("home.details")}</summary>
      <div className={C.stack}>
        {details.length > 0 && (
          <ul className={`${C.faint} details`}>
            {details.map(([k, v]) => {
              const q = QuestionKey.safeParse(k);
              return (
                <li key={k}>
                  {q.success ? t(`detail.${q.data}`) : k}: <DetailValue value={v} from={from} />
                </li>
              );
            })}
          </ul>
        )}
        {plan && <PlanCard advice={plan} />}
      </div>
    </details>
  );
}

/**
 * When the work is: the day from the request's structured detail, shown by this phone in its own words (never
 * translated), then the time as the other side wrote it. A request from before the When chips has only its free text.
 */
function When({ request, from }: { request: JobRequest; from: Lang | undefined }) {
  const { t, date } = useI18n();
  const day = dayOf(request);
  const time = request.details[WhenDetail.time];
  if (day === undefined)
    return (
      <span className={C.muted}>
        <Said text={request.when} from={from} />
      </span>
    );
  return (
    <span className={C.muted}>
      {day === EVERY_DAY ? t("when.daily") : date(dayDate(day))}
      {time && (
        <>
          {" · "}
          <Said text={time} from={from} />
        </>
      )}
    </span>
  );
}
