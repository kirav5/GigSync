import {
  type GigDevice,
  type JobRecord,
  type NeedTo,
  type TakeOver as TakeOverDetail,
  TaskKind,
  type TimeAsk,
  termsLines,
  type WorkerRules,
} from "@gigsync/core";
import { EngagementStatus, type JobTerms, PaymentMethod, PaymentStatus, type Question, Role } from "@gigsync/protocol";
import type { ReactNode } from "react";
import { useI18n } from "../i18n.js";
import { PayBox } from "../payments/PayBox.js";
import { useStep } from "../payments/useStep.js";
import { WorkerPay } from "../payments/WorkerPay.js";
import { BusyGroup } from "../ui/BusyGroup.js";
import { C } from "../ui/cls.js";
import { jobPrice, money } from "../ui/places.js";
import { useBusy } from "../ui/useBusy.js";
import { requestWork } from "../ui/work.js";
import type { GigView } from "../useGig.js";
import { AnswerForm } from "./AnswerForm.js";
import { SignCard } from "./JobDecide.js";
import { AskAgain } from "./job/AskAgain.js";
import { MoreSheet } from "./job/MoreSheet.js";
import { type ApproveDetail, RequestFits } from "./job/RequestFits.js";
import { ReviewCard } from "./job/ReviewCard.js";
import { StuckCard, TakeOver } from "./job/TalkDecide.js";
import { TimeCard } from "./job/TimeCard.js";

export interface JobActionProps {
  job: JobRecord;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Opens About me to add a UPI ID. The worker's Today passes it; the consumer's My jobs has no use for it. */
  onAddPayee?: () => void;
  /** Opens a new Find chat, for the same worker or anyone: a household's Records passes it for jobs that ended. */
  onAgain?: (to?: NeedTo) => void;
  /** The worker's own rules (their card), so a request that fits can say the distance and hours it was checked by. */
  rules?: WorkerRules | undefined;
}

const S = EngagementStatus.enum;
const P = PaymentStatus.enum;
/** A job its agents are still talking about: the owner may step in. */
const TALKING: ReadonlySet<EngagementStatus> = new Set([S.sent, S.clarifying, S.negotiating]);
/** Between the sentence read aloud and each term after it. */
const SAY_PAUSE = ". ";

/**
 * The one thing to do now on this job, as the card's hero, and nothing else: a decision first (the request that fits,
 * a time, questions, the agents stuck, the deal to sign), each with a speaker button that reads it aloud (committing
 * stays a tap); then `talk`, the agents' turns while they are at it, with the turn and "Take over"; then the day's
 * step, the money and the note box. `them` is the other side's name as the card shows it. One move at a time: a tap
 * holds every move here until the job has been synced and read back, and a move that failed says so. Notes stay open
 * meanwhile, since they queue by themselves.
 */
export function JobActions(props: JobActionProps & { them: string; talk?: ReactNode }) {
  const { job, view, device, run, onAddPayee, onAgain, rules, them, talk } = props;
  const { lang, t } = useI18n();
  const { busy, guard } = useBusy();
  const act = (work: () => Promise<unknown>) => guard(() => run(work));
  const { step, error } = useStep(act);
  const id = job.engagement.id;
  const status = job.engagement.status;
  const isWorker = job.engagement.role === Role.enum.provider;
  const task = (kind: TaskKind) => view.tasks.find((k) => k.kind === kind && k.engagement === id);
  const payments = view.payments.filter((p) => p.engagement === id);
  /** The terms the agents reached, waiting for this owner's signature. */
  const terms = task(TaskKind.confirmDeal)?.detail as JobTerms | undefined;
  const questions = task(TaskKind.answerQuestions);
  const approve = task(TaskKind.approveRequest);
  // A time the household did not ask for is its own decision, and the talk waits on it.
  const time = isWorker ? undefined : task(TaskKind.newTime);
  const talking = !time && TALKING.has(status);
  const stuck = talking ? task(TaskKind.takeOver) : undefined;
  const paid = payments.find((p) => p.status === P.confirmed && !p.advance);
  const decide = { job, view, device, step, them };

  return (
    <div className={`${C.stack} job-now`}>
      <BusyGroup busy={busy}>
        {approve && (
          <RequestFits
            job={job}
            detail={approve.detail as ApproveDetail}
            rules={rules}
            say={t("home.say_approve", { name: them, trade: requestWork(t, job.request) })}
            onApprove={() => step(() => device.approveRequest(id))}
            onDecline={() => step(() => device.declineRequest(id))}
          />
        )}
        {time && <TimeCard job={job} ask={time.detail as TimeAsk} device={device} step={step} them={them} />}
        {stuck && <StuckCard {...decide} detail={stuck.detail as TakeOverDetail | undefined} />}
        {questions && (
          <AnswerForm
            questions={questions.detail as Question[]}
            suggested={job.suggested}
            say={t("home.say_answer", { name: them })}
            onSend={(a) => step(() => device.answer(id, a))}
          />
        )}
        {terms && (
          <SignCard
            price={jobPrice(lang, job.request, terms.price_paise)}
            terms={terms.terms}
            asked={isWorker ? undefined : job.request.terms}
            place={job.request.locality}
            them={them}
            theySigned={job.theirs?.terms.offer_id === terms.offer_id}
            say={[
              t("home.say_sign", { name: them, price: jobPrice(lang, job.request, terms.price_paise) }),
              ...termsLines(lang, terms.terms),
            ].join(SAY_PAUSE)}
            onSign={() => step(() => device.confirmDeal(id))}
            onDecline={() => step(() => device.declineDeal(id))}
          />
        )}
        {/* Turning a request down already ends it: no second way out beside the request that fits. */}
        {talking && !stuck && !approve && <TakeOver {...decide} />}
        {talk}
        {onAgain && <AskAgain job={job} them={them} onAgain={onAgain} />}
        {/* Only Today lists a worker's jobs, and it always passes onAddPayee. */}
        {isWorker && onAddPayee && (
          <WorkerPay job={job} view={view} device={device} run={act} onAddPayee={onAddPayee} />
        )}
        {!isWorker &&
          payments
            .filter((p) => p.status === P.requested && p.method === PaymentMethod.enum.upi)
            .map((p) => <PayBox key={p.id} payment={p} device={device} step={step} job={job} them={them} />)}
        {!isWorker && status === S.delivered && !job.review && paid && (
          <ReviewCard
            them={them}
            paid={money(paid.amount_paise)}
            onSend={(stars, text) => step(() => device.review(id, { stars, text }))}
          />
        )}
        {error && <p className={C.error}>{error}</p>}
        {/* A note, an advance, cancel and the record's small print: one tap away, not on the card. */}
        <MoreSheet
          job={job}
          device={device}
          step={step}
          run={act}
          onNote={(text) => run(() => device.update(id, text))}
          them={them}
          isWorker={isWorker}
          payments={payments}
          onAddPayee={onAddPayee}
        />
      </BusyGroup>
    </div>
  );
}
