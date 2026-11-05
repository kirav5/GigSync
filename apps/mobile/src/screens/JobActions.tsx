import {
  asciiDigits,
  type GigDevice,
  type JobRecord,
  type MessageKey,
  type NeedTo,
  nextWorkerStep,
  TaskKind,
  termsLines,
  UNDER_WAY,
  type WorkerStep,
  workStarted,
} from "@gigsync/core";
import {
  EngagementStatus,
  type JobTerms,
  type Payment,
  PaymentMethod,
  PaymentStatus,
  type Question,
  Role,
  UpdateCode,
} from "@gigsync/protocol";
import { type FormEvent, useEffect, useState } from "react";
import { useI18n } from "../i18n.js";
import { qrDataUrl } from "../payments/qr.js";
import { type Step, useStep } from "../payments/useStep.js";
import { WorkerPay } from "../payments/WorkerPay.js";
import { BusyGroup } from "../ui/BusyGroup.js";
import { C } from "../ui/cls.js";
import { jobPrice, money } from "../ui/places.js";
import { useBusy } from "../ui/useBusy.js";
import { Working } from "../ui/Working.js";
import { requestWork } from "../ui/work.js";
import type { GigView } from "../useGig.js";
import { AnswerForm } from "./AnswerForm.js";
import { ApproveCard, type ApproveDetail, SignCard } from "./JobDecide.js";
import { AskAgain } from "./job/AskAgain.js";
import { CancelJob } from "./job/CancelJob.js";
import { NoteBox } from "./job/NoteBox.js";
import { TalkDecide } from "./job/TalkDecide.js";

export interface JobActionProps {
  job: JobRecord;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Opens About me to add a UPI ID. The worker's Today passes it; the consumer's My jobs has no use for it. */
  onAddPayee?: () => void;
  /** Opens a new Find chat, for the same worker or anyone: a household's Records passes it for jobs that ended. */
  onAgain?: (to?: NeedTo) => void;
}

const S = EngagementStatus.enum;
const P = PaymentStatus.enum;
const U = UpdateCode.enum;
/** Once both have signed, a worker may leave a note for the customer. */
const SIGNED: ReadonlySet<EngagementStatus> = new Set([S.agreed, S.in_progress, S.delivered]);
/** The worker's next move as its button says it: on the way, then arrived and started, then done. */
const STEP_LABEL: Readonly<Record<WorkerStep, MessageKey>> = {
  [U.on_my_way]: "update.on_my_way",
  [U.started]: "job.start_work",
  [U.done]: "job.mark_done",
};
const STARS = [5, 4, 3, 2, 1] as const;
/** Between the sentence read aloud and each term after it. */
const SAY_PAUSE = ". ";

/**
 * The decisions and moves open to this owner on this job, and nothing else: decisions first, each with a speaker
 * button that reads it aloud (committing stays a tap), then the work, the money and the note box. `them` is the
 * other side's name as the card shows it. One move at a time: a tap holds every move here until the job has been
 * synced and read back, and a move that failed says so. Notes stay open meanwhile, since they queue by themselves.
 */
export function JobActions({ job, view, device, run, onAddPayee, onAgain, them }: JobActionProps & { them: string }) {
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
  const next = nextWorkerStep(job);
  /** The worker's next step: a progress update, or the work handed over once it is done. */
  const moveOn = (to: WorkerStep) =>
    to === U.done ? device.deliver(id, { code: U.done }) : device.update(id, { code: to });

  return (
    <div className={C.stack}>
      <BusyGroup busy={busy}>
        <TalkDecide job={job} view={view} device={device} step={step} them={them} />
        {onAgain && <AskAgain job={job} them={them} onAgain={onAgain} />}
        {approve && (
          <ApproveCard
            detail={approve.detail as ApproveDetail}
            say={t("home.say_approve", { name: them, trade: requestWork(t, job.request) })}
            onApprove={() => step(() => device.approveRequest(id))}
            onDecline={() => step(() => device.declineRequest(id))}
          />
        )}
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
            say={[
              t("home.say_sign", { name: them, price: jobPrice(lang, job.request, terms.price_paise) }),
              ...termsLines(lang, terms.terms),
            ].join(SAY_PAUSE)}
            onSign={() => step(() => device.confirmDeal(id))}
            onDecline={() => step(() => device.declineDeal(id))}
          />
        )}
        {/* Until the work is handed over, either side may call the job off; the worker moves it on one step at a time. */}
        {UNDER_WAY.has(status) && (
          <CancelJob started={workStarted(job)} onCancel={(stop) => step(() => device.cancelJob(id, stop))}>
            {/* Keyed by step: the next step is a new button, so a tap meant for one never lands on the next. */}
            {isWorker && next && (
              <button key={next} type={C.button} className={C.secondary} onClick={() => step(() => moveOn(next))}>
                {t(STEP_LABEL[next])}
              </button>
            )}
          </CancelJob>
        )}
        {/* Only Today lists a worker's jobs, and it always passes onAddPayee. */}
        {isWorker && onAddPayee && (
          <WorkerPay job={job} view={view} device={device} run={act} onAddPayee={onAddPayee} />
        )}
        {!isWorker &&
          payments
            .filter((p) => p.status === P.requested && p.method === PaymentMethod.enum.upi)
            .map((p) => <PayBox key={p.id} payment={p} device={device} step={step} />)}
        {!isWorker &&
          status === S.delivered &&
          !job.review &&
          payments.some((p) => p.status === P.confirmed && !p.advance) && (
            <ReviewForm onSend={(stars, text) => step(() => device.review(id, { stars, text }))} />
          )}
        {error && <p className={C.error}>{error}</p>}
      </BusyGroup>
      {isWorker && SIGNED.has(status) && <NoteBox onSend={(text) => run(() => device.update(id, text))} />}
    </div>
  );
}

/**
 * The consumer pays in their own UPI app; GigSync only shows the QR and records the reference they paste back. When
 * the link cannot be built (this phone never got the worker's sealed payment request) it says so instead of a dead QR.
 */
function PayBox({ payment, device, step }: { payment: Payment; device: GigDevice; step: Step }) {
  const { t } = useI18n();
  const [link, setLink] = useState<string>();
  const [qr, setQr] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false);
    void (async () => {
      try {
        const l = await device.upiLink(payment.id);
        const image = await qrDataUrl(l);
        if (!live) return;
        setLink(l);
        setQr(image);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [device, payment.id]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const utr = asciiDigits(String(new FormData(e.currentTarget).get("utr") ?? "").trim());
    step(() => device.markPaid(payment.id, utr || undefined));
  }
  return (
    <form className={C.stack} onSubmit={submit} aria-label={t("a11y.pay")}>
      <span className={C.label}>
        {t(payment.advance ? "job.pay_advance" : "job.pay_by_upi", { price: money(payment.amount_paise) })}
      </span>
      {failed && <p className={C.error}>{t("error.generic")}</p>}
      <Working on={!qr && !failed} />
      {qr && <img src={qr} alt={t("a11y.qr")} width={160} height={160} />}
      {link && (
        <a className={C.secondary} href={link}>
          {t("job.open_upi")}
        </a>
      )}
      <input
        className={C.field}
        name="utr"
        aria-label={t("a11y.utr")}
        placeholder={t("job.utr_placeholder")}
        inputMode="numeric"
      />
      <div className={C.actions}>
        <button type={C.submit} className={C.accent}>
          {t("job.paid")}
        </button>
      </div>
    </form>
  );
}

function ReviewForm({ onSend }: { onSend: (stars: number, text: string) => void }) {
  const { t } = useI18n();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    onSend(Number(v.get("stars")), String(v.get("text") ?? "").trim());
  }
  return (
    <form className={C.row} onSubmit={submit} aria-label={t("a11y.review")}>
      <select className={C.field} name="stars" aria-label={t("a11y.stars")} defaultValue={STARS[0]}>
        {STARS.map((s) => (
          <option key={s} value={s}>
            {"★".repeat(s)}
          </option>
        ))}
      </select>
      <input
        className={C.field}
        name="text"
        aria-label={t("a11y.review_text")}
        placeholder={t("job.review_placeholder")}
      />
      <button type={C.submit} className={C.btn}>
        {t("job.send_review")}
      </button>
    </form>
  );
}
