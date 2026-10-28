import { asciiDigits, type GigDevice, type JobRecord, TaskKind } from "@gigsync/core";
import {
  EngagementStatus,
  type JobTerms,
  type Payment,
  PaymentStatus,
  type Question,
  Role,
  UpdateCode,
} from "@gigsync/protocol";
import { type FormEvent, useEffect, useState } from "react";
import { useI18n } from "../i18n.js";
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
}

const S = EngagementStatus.enum;
const P = PaymentStatus.enum;
const U = UpdateCode.enum;
/** A worker may say they are on the way, mark the job done, or ask to be paid, once both have signed. */
const SIGNED: ReadonlySet<EngagementStatus> = new Set([S.agreed, S.in_progress, S.delivered]);
const STARS = [5, 4, 3, 2, 1] as const;

/** The decisions and moves open to this owner on this job, and nothing else. */
export function JobActions({ job, view, device, run }: JobActionProps) {
  const { t } = useI18n();
  const id = job.engagement.id;
  const status = job.engagement.status;
  const isWorker = job.engagement.role === Role.enum.provider;
  const task = (kind: TaskKind) => view.tasks.find((k) => k.kind === kind && k.engagement === id);
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
          onApprove={() => void run(() => device.approveRequest(id))}
          onDecline={() => void run(() => device.declineRequest(id))}
        />
      )}
      {questions && (
        <AnswerForm questions={questions.detail as Question[]} onSend={(a) => run(() => device.answer(id, a))} />
      )}
      {confirm && (
        <fieldset className={C.stack} aria-label={t("a11y.sign")}>
          <span className={C.muted}>{t("job.reached", price((confirm.detail as JobTerms).price_paise))}</span>
          <div className={C.actions}>
            <button type={C.button} className={C.accent} onClick={() => void run(() => device.confirmDeal(id))}>
              {t("job.sign", price((confirm.detail as JobTerms).price_paise))}
            </button>
            <button type={C.button} className={C.secondary} onClick={() => void run(() => device.declineDeal(id))}>
              {t("job.decline")}
            </button>
          </div>
        </fieldset>
      )}
      {isWorker && SIGNED.has(status) && (
        <>
          <div className={C.actions}>
            {status === S.agreed && (
              <button
                type={C.button}
                className={C.secondary}
                onClick={() => void run(() => device.update(id, { code: U.on_my_way }))}
              >
                {t("update.on_my_way")}
              </button>
            )}
            {status !== S.delivered && (
              <button
                type={C.button}
                className={C.secondary}
                onClick={() => void run(() => device.deliver(id, { code: U.done }))}
              >
                {t("job.mark_done")}
              </button>
            )}
            {payments.length === 0 && (
              <button
                type={C.button}
                className={C.accent}
                onClick={() => void run(() => device.requestPayment(id, job.request.need.slice(0, 40)))}
              >
                {t("job.ask_payment")}
              </button>
            )}
          </div>
          <NoteBox onSend={(text) => run(() => device.update(id, text))} />
        </>
      )}
      {paid && (
        <fieldset className={C.stack} aria-label={t("a11y.confirm_payment")}>
          <span className={C.muted}>{t("job.customer_paid", price((paid.detail as Payment).amount_paise))}</span>
          <div className={C.actions}>
            <button
              type={C.button}
              className={C.accent}
              onClick={() => void run(() => device.confirmPayment((paid.detail as Payment).id))}
            >
              {t("job.money_received")}
            </button>
            <button
              type={C.button}
              className={C.danger}
              onClick={() => void run(() => device.disputePayment((paid.detail as Payment).id))}
            >
              {t("job.not_received")}
            </button>
          </div>
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

/** The worker's own words to the customer, sent as written and tagged with this phone's language. */
function NoteBox({ onSend }: { onSend: (text: string) => Promise<unknown> }) {
  const { t } = useI18n();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const text = String(new FormData(form).get("note") ?? "").trim();
    if (!text) return;
    void onSend(text).then(() => form.reset());
  }
  return (
    <form className={C.row} onSubmit={submit} aria-label={t("a11y.note")}>
      <input className={C.field} name="note" aria-label={t("a11y.note")} placeholder={t("job.note_placeholder")} />
      <button type={C.submit} className={C.btn}>
        {t("job.send_note")}
      </button>
    </form>
  );
}

/** The consumer pays in their own UPI app; GigSync only shows the QR and records the reference they paste back. */
function PayBox({ payment, device, run }: { payment: Payment; device: GigDevice; run: JobActionProps["run"] }) {
  const { t } = useI18n();
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
    const utr = asciiDigits(String(new FormData(e.currentTarget).get("utr") ?? "").trim());
    void run(() => device.markPaid(payment.id, utr || undefined));
  }
  return (
    <form className={C.stack} onSubmit={submit} aria-label={t("a11y.pay")}>
      <span className={C.label}>{t("job.pay_by_upi", { price: money(payment.amount_paise) })}</span>
      {qr && <img src={qr} alt={t("a11y.qr")} width={160} height={160} />}
      {link && (
        <a className={C.linkBtn} href={link}>
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
      <div>
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
