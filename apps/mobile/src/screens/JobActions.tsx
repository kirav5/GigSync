import {
  asciiDigits,
  type GigDevice,
  type JobRecord,
  type MessageKey,
  nextWorkerStep,
  TaskKind,
  termsLines,
  UNDER_WAY,
  type WorkerStep,
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
import { WorkerPay } from "../payments/WorkerPay.js";
import { C } from "../ui/cls.js";
import { jobPrice, money } from "../ui/places.js";
import { requestWork } from "../ui/work.js";
import type { GigView } from "../useGig.js";
import { AnswerForm } from "./AnswerForm.js";
import { ApproveCard, type ApproveDetail, SignCard } from "./JobDecide.js";
import { CancelJob } from "./job/CancelJob.js";
import { TalkDecide } from "./job/TalkDecide.js";

export interface JobActionProps {
  job: JobRecord;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Opens About me to add a UPI ID. The worker's Today passes it; the consumer's My jobs has no use for it. */
  onAddPayee?: () => void;
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
 * other side's name as the card shows it.
 */
export function JobActions({ job, view, device, run, onAddPayee, them }: JobActionProps & { them: string }) {
  const { lang, t } = useI18n();
  const id = job.engagement.id;
  const status = job.engagement.status;
  const isWorker = job.engagement.role === Role.enum.provider;
  const task = (kind: TaskKind) => view.tasks.find((k) => k.kind === kind && k.engagement === id);
  const payments = view.payments.filter((p) => p.engagement === id);
  /** The terms the agents reached, waiting for this owner's signature. */
  const terms = task(TaskKind.confirmDeal)?.detail as JobTerms | undefined;
  const questions = task(TaskKind.answerQuestions);
  const approve = task(TaskKind.approveRequest);
  const step = nextWorkerStep(job);
  /** The worker's next step: a progress update, or the work handed over once it is done. */
  const moveOn = (next: WorkerStep) =>
    next === U.done ? device.deliver(id, { code: U.done }) : device.update(id, { code: next });

  return (
    <div className={C.stack}>
      <TalkDecide job={job} view={view} device={device} run={run} them={them} />
      {approve && (
        <ApproveCard
          detail={approve.detail as ApproveDetail}
          say={t("home.say_approve", { name: them, trade: requestWork(t, job.request) })}
          onApprove={() => void run(() => device.approveRequest(id))}
          onDecline={() => void run(() => device.declineRequest(id))}
        />
      )}
      {questions && (
        <AnswerForm
          questions={questions.detail as Question[]}
          suggested={job.suggested}
          say={t("home.say_answer", { name: them })}
          onSend={(a) => run(() => device.answer(id, a))}
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
          onSign={() => void run(() => device.confirmDeal(id))}
          onDecline={() => void run(() => device.declineDeal(id))}
        />
      )}
      {/* Until the work is handed over, either side may call the job off; the worker moves it on one step at a time. */}
      {UNDER_WAY.has(status) && (
        <CancelJob onCancel={() => void run(() => device.cancelJob(id))}>
          {isWorker && step && (
            <button type={C.button} className={C.secondary} onClick={() => void run(() => moveOn(step))}>
              {t(STEP_LABEL[step])}
            </button>
          )}
        </CancelJob>
      )}
      {/* Only Today lists a worker's jobs, and it always passes onAddPayee. */}
      {isWorker && onAddPayee && <WorkerPay job={job} view={view} device={device} run={run} onAddPayee={onAddPayee} />}
      {isWorker && SIGNED.has(status) && <NoteBox onSend={(text) => run(() => device.update(id, text))} />}
      {!isWorker &&
        payments
          .filter((p) => p.status === P.requested && p.method === PaymentMethod.enum.upi)
          .map((p) => <PayBox key={p.id} payment={p} device={device} run={run} />)}
      {!isWorker && status === S.delivered && !job.review && payments.some((p) => p.status === P.confirmed) && (
        <ReviewForm onSend={(stars, text) => run(() => device.review(id, { stars, text }))} />
      )}
    </div>
  );
}

/** The note field's name in its form. */
const NOTE_FIELD = "note";

/** The worker's own words to the customer, sent as written and tagged with this phone's language. */
function NoteBox({ onSend }: { onSend: (text: string) => Promise<unknown> }) {
  const { t } = useI18n();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const field = form.elements.namedItem(NOTE_FIELD);
    const text = String(new FormData(form).get(NOTE_FIELD) ?? "").trim();
    if (!text) return;
    // Cleared at once, not when the send finishes: that would wipe a next note typed meanwhile. Sends queue in order;
    // a failed one puts its words back if the box is still empty.
    form.reset();
    void onSend(text).catch(() => {
      if (field instanceof HTMLInputElement && !field.value) field.value = text;
    });
  }
  return (
    <form className={C.row} onSubmit={submit} aria-label={t("a11y.note")}>
      <input
        className={C.field}
        name={NOTE_FIELD}
        aria-label={t("a11y.note")}
        placeholder={t("job.note_placeholder")}
      />
      <button type={C.submit} className={C.btn}>
        {t("job.send_note")}
      </button>
    </form>
  );
}

/**
 * The consumer pays in their own UPI app; GigSync only shows the QR and records the reference they paste back. When
 * the link cannot be built (this phone never got the worker's sealed payment request) it says so instead of a dead QR.
 */
function PayBox({ payment, device, run }: { payment: Payment; device: GigDevice; run: JobActionProps["run"] }) {
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
    void run(() => device.markPaid(payment.id, utr || undefined));
  }
  return (
    <form className={C.stack} onSubmit={submit} aria-label={t("a11y.pay")}>
      <span className={C.label}>{t("job.pay_by_upi", { price: money(payment.amount_paise) })}</span>
      {failed && <p className={C.error}>{t("error.generic")}</p>}
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

function ReviewForm({ onSend }: { onSend: (stars: number, text: string) => Promise<unknown> }) {
  const { t } = useI18n();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    void onSend(Number(v.get("stars")), String(v.get("text") ?? "").trim());
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
