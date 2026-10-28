import { type GigDevice, type JobRecord, TaskKind, t } from "@gigsync/core";
import {
  EngagementStatus,
  type JobTerms,
  type Lang,
  type Payment,
  PaymentStatus,
  type Question,
  Role,
} from "@gigsync/protocol";
import { type FormEvent, useEffect, useState } from "react";
import { qrDataUrl } from "../payments/qr.js";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";
import type { GigView } from "../useGig.js";
import { AnswerForm, ApproveCard, type ApproveDetail } from "./JobDecide.js";

export interface JobActionProps {
  job: JobRecord;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** The owner's language, for everything on the job they read. */
  lang: Lang;
}

const S = EngagementStatus.enum;
const P = PaymentStatus.enum;
/** A worker may say they are on the way, mark the job done, or ask to be paid, once both have signed. */
const SIGNED: ReadonlySet<EngagementStatus> = new Set([S.agreed, S.in_progress, S.delivered]);
const STARS = [5, 4, 3, 2, 1] as const;

/** The decisions and moves open to this owner on this job, and nothing else. */
export function JobActions({ job, view, device, run, lang }: JobActionProps) {
  const id = job.engagement.id;
  const status = job.engagement.status;
  const isWorker = job.engagement.role === Role.enum.provider;
  const task = (kind: TaskKind) => view.tasks.find((t) => t.kind === kind && t.engagement === id);
  const payments = view.payments.filter((p) => p.engagement === id);
  const confirm = task(TaskKind.confirmDeal);
  const questions = task(TaskKind.answerQuestions);
  const paid = task(TaskKind.confirmPayment);
  const approve = task(TaskKind.approveRequest);
  const price = (paise: number) => ({ price: money(paise) });

  return (
    <div className={C.stack}>
      {approve && (
        <ApproveCard
          detail={approve.detail as ApproveDetail}
          lang={lang}
          onApprove={() => void run(() => device.approveRequest(id))}
          onDecline={() => void run(() => device.declineRequest(id))}
        />
      )}
      {questions && (
        <AnswerForm
          questions={questions.detail as Question[]}
          lang={lang}
          onSend={(a) => run(() => device.answer(id, a))}
        />
      )}
      {confirm && (
        <fieldset className={C.row} aria-label="Sign the deal">
          <span className={C.muted}>{t(lang, "job.reached", price((confirm.detail as JobTerms).price_paise))}</span>
          <button type={C.button} className={C.accent} onClick={() => void run(() => device.confirmDeal(id))}>
            {t(lang, "job.sign", price((confirm.detail as JobTerms).price_paise))}
          </button>
          <button type={C.button} className={C.secondary} onClick={() => void run(() => device.declineDeal(id))}>
            {t(lang, "job.decline")}
          </button>
        </fieldset>
      )}
      {isWorker && SIGNED.has(status) && (
        <div className={C.row}>
          {status === S.agreed && (
            <button
              type={C.button}
              className={C.secondary}
              onClick={() => void run(() => device.update(id, t(lang, "job.on_my_way")))}
            >
              {t(lang, "job.on_my_way")}
            </button>
          )}
          {status !== S.delivered && (
            <button
              type={C.button}
              className={C.secondary}
              onClick={() => void run(() => device.deliver(id, t(lang, "job.work_done")))}
            >
              {t(lang, "job.mark_done")}
            </button>
          )}
          {payments.length === 0 && (
            <button
              type={C.button}
              className={C.accent}
              onClick={() => void run(() => device.requestPayment(id, job.request.need.slice(0, 40)))}
            >
              {t(lang, "job.ask_payment")}
            </button>
          )}
        </div>
      )}
      {paid && (
        <fieldset className={C.row} aria-label="Confirm payment">
          <span className={C.muted}>Customer says they paid {money((paid.detail as Payment).amount_paise)}.</span>
          <button
            type={C.button}
            className={C.accent}
            onClick={() => void run(() => device.confirmPayment((paid.detail as Payment).id))}
          >
            Money received
          </button>
          <button
            type={C.button}
            className={C.danger}
            onClick={() => void run(() => device.disputePayment((paid.detail as Payment).id))}
          >
            Not received
          </button>
        </fieldset>
      )}
      {!isWorker &&
        payments
          .filter((p) => p.status === P.requested)
          .map((p) => <PayBox key={p.id} payment={p} device={device} run={run} />)}
      {!isWorker && status === S.delivered && !job.review && payments.some((p) => p.status === P.confirmed) && (
        <ReviewForm onSend={(stars, text) => run(() => device.review(id, { stars, text }))} />
      )}
    </div>
  );
}

/** The consumer pays in their own UPI app; GigSync only shows the QR and records the reference they paste back. */
function PayBox({ payment, device, run }: { payment: Payment; device: GigDevice; run: JobActionProps["run"] }) {
  const [link, setLink] = useState<string>();
  const [qr, setQr] = useState<string>();
  useEffect(() => {
    void device.upiLink(payment.id).then(async (l) => {
      setLink(l);
      setQr(await qrDataUrl(l));
    });
  }, [device, payment.id]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const utr = String(new FormData(e.currentTarget).get("utr") ?? "").trim();
    void run(() => device.markPaid(payment.id, utr || undefined));
  }
  return (
    <form className={C.stack} onSubmit={submit} aria-label="Pay">
      <span className={C.label}>Pay {money(payment.amount_paise)} by UPI</span>
      {qr && <img src={qr} alt="UPI QR code" width={160} height={160} />}
      {link && (
        <a className={C.linkBtn} href={link}>
          Open in a UPI app
        </a>
      )}
      <input
        className={C.field}
        name="utr"
        aria-label="UPI reference"
        placeholder="12-digit UPI reference"
        inputMode="numeric"
      />
      <div>
        <button type={C.submit} className={C.accent}>
          I've paid
        </button>
      </div>
    </form>
  );
}

function ReviewForm({ onSend }: { onSend: (stars: number, text: string) => Promise<unknown> }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    void onSend(Number(v.get("stars")), String(v.get("text") ?? "").trim());
  }
  return (
    <form className={C.row} onSubmit={submit} aria-label="Review">
      <select className={C.field} name="stars" aria-label="Stars" defaultValue={STARS[0]}>
        {STARS.map((s) => (
          <option key={s} value={s}>
            {"★".repeat(s)}
          </option>
        ))}
      </select>
      <input className={C.field} name="text" aria-label="Review text" placeholder="How did it go?" />
      <button type={C.submit} className={C.btn}>
        Send review
      </button>
    </form>
  );
}
