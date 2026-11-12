import { canRecommend, type JobRecord, NUMBER_ONLY, t as say, UNDER_WAY, WhenDetail } from "@gigsync/core";
import { EngagementStatus, type Lang, QuestionKey, Role } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Said } from "../ui/Said.js";
import { requestWork } from "../ui/work.js";
import { AgentTalk } from "./AgentTalk.js";
import { DetailValue } from "./DetailValue.js";
import { type JobActionProps, JobActions } from "./JobActions.js";
import { PlanCard } from "./JobDecide.js";
import { JobProgress } from "./JobProgress.js";
import { RemovedLine, RestoredLine } from "./JobSettled.js";
import { ContactCard } from "./job/ContactCard.js";
import { CancelLine, DealLine, Notes, PaymentLines, ReviewLine } from "./job/JobFacts.js";
import { JobHead } from "./job/JobHead.js";
import { ProblemCard } from "./ProblemCard.js";
import { RecommendWorker } from "./qr/RecommendWorker.js";
import { RestoredActions } from "./RestoredActions.js";
import "./jobs.css";
import "./job/job.css";

const S = EngagementStatus.enum;
/** While the agents are at it, their talk is the card's middle, open as a chat; once settled it folds to the end. */
const TALKING: ReadonlySet<EngagementStatus> = new Set([
  S.sent,
  S.clarifying,
  S.responded,
  S.negotiating,
  S.confirming,
]);

/** The When details are in the head; the generic list leaves them out. */
const WHEN_KEYS: ReadonlySet<string> = new Set(Object.values(WhenDetail));

/**
 * One job as this owner sees it, laid out as the design's job screen: who, the work and when; the step line once both
 * signed; then the one thing to do now (JobActions), with the agents' talk beside it while they talk; then the
 * contact, the deal, and what the job has on record. What the agents said once settled, and the request's details
 * and the plan, are folded away at the end.
 */
export function JobThread(props: JobActionProps) {
  const { job, view, device, run } = props;
  const { lang, t } = useI18n();
  const e = job.engagement;
  const isWorker = e.role === Role.enum.provider;
  const them =
    view.names[e.counterpart] || job.contact?.name || job.their_name || t(isWorker ? "job.customer" : "job.worker");
  const payments = view.payments.filter((p) => p.engagement === e.id);
  // The consumer's free text (need, when, typed answers, review) is in the language their request says.
  const theirs = isWorker ? job.request.lang : undefined;
  // The request's words, unless they only repeat the trade or are a bare count (older requests used the first answer).
  const need = job.request.need.trim();
  const tradeName = job.request.skill?.text ?? say(job.request.lang, `trade.${job.request.trade}`);
  const needShown = need && need !== tradeName && !NUMBER_ONLY.test(need) ? need : "";
  // A restored job's messages never reached the server, and another phone answers an elsewhere one (ADR 0045):
  // neither has moves here, so the talk, if any, stays at the end.
  const live = !job.restored && !job.elsewhere;
  const talkFirst = live && TALKING.has(e.status);
  const talk = <AgentTalk job={job} them={them} from={theirs} device={device} />;

  return (
    <article
      className={`${C.card} job-card`}
      aria-label={t("a11y.job_with", { name: them })}
      data-status={e.status}
      lang={lang}
    >
      <JobHead job={job} them={them} from={theirs} />
      <JobProgress job={job} payments={payments} them={them} />
      {needShown && (
        <p className="job-need">
          <Said text={needShown} from={theirs} />
        </p>
      )}
      <RestoredLine job={job} />

      {/* Another of this owner's phones claimed the request and negotiates it there (ADR 0045): nothing to do here. */}
      {job.elsewhere && <p className={C.faint}>{t("job.elsewhere")}</p>}
      {/* A restored job's messages never reached the server, so its thread cannot go on: it ends through the record. */}
      {job.restored && !job.elsewhere && <RestoredActions job={job} device={device} run={run} them={them} />}
      {live && <JobActions {...props} them={them} talk={talkFirst ? talk : undefined} />}

      {/* The household has no step of its own on the day: calling the worker is its main move then. */}
      <ContactCard job={job} primary={!isWorker && UNDER_WAY.has(e.status)} />
      <DealLine job={job} from={theirs} />
      {canRecommend(job) && (
        <RecommendWorker device={device} run={run} job={job} name={them} work={requestWork(t, job.request)} />
      )}
      <RemovedLine job={job} />
      <ProblemCard job={job} them={them} device={device} run={run} />
      <Notes job={job} />
      <CancelLine job={job} />
      <PaymentLines payments={payments} />
      <ReviewLine job={job} from={theirs} />

      {!talkFirst && talk}
      <More job={job} from={theirs} />
    </article>
  );
}

/**
 * Folded under Details: the request's details (the When ones are in the head) and the worker's private price plan.
 * Nothing at all when there is neither. The offers are in the agents' talk.
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
