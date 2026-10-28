import { type Advice, questionText, reasonText, t, YES_NO_QUESTIONS } from "@gigsync/core";
import { DetailFlag, type Lang, type Question, type QuestionKey } from "@gigsync/protocol";
import type { FormEvent } from "react";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";

const ANSWER_ID = "answer-";

/** What the worker's agent puts on the approval task: what tripped the rule, and the plan it would quote from. */
export interface ApproveDetail {
  flagged: QuestionKey[];
  advice: Advice;
}

/** The worker's agent's price plan and why, in the owner's language. Private: it never leaves this phone. */
export function PlanCard({ advice, lang }: { advice: Advice; lang: Lang }) {
  return (
    <fieldset className={C.stack} aria-label="Plan">
      <span className={C.label}>{t(lang, "plan.title")}</span>
      <ul className={C.stack}>
        {advice.reasons.map((r) => (
          <li key={r.kind + ("key" in r ? r.key : "")} className={C.muted}>
            {reasonText(lang, r)}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** The job has something the worker asked to see first: nothing is quoted until they say go ahead or no. */
export function ApproveCard({
  detail,
  lang,
  onApprove,
  onDecline,
}: {
  detail: ApproveDetail;
  lang: Lang;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const items = detail.flagged.map((k) => t(lang, `detail.${k}`)).join(", ");
  return (
    <fieldset className={C.stack} aria-label="Approve the request">
      <span className={C.label}>{t(lang, "approve.title")}</span>
      <span>{t(lang, "approve.flagged", { items })}</span>
      <div className={C.row}>
        <button type={C.button} className={C.accent} onClick={onApprove}>
          {t(lang, "approve.yes", { price: money(detail.advice.mandate.opening_paise) })}
        </button>
        <button type={C.button} className={C.secondary} onClick={onDecline}>
          {t(lang, "approve.no")}
        </button>
      </div>
    </fieldset>
  );
}

/** The other side's agent's questions, in this owner's language: yes-or-no ones as a toggle, the rest typed. */
export function AnswerForm({
  questions,
  lang,
  onSend,
}: {
  questions: Question[];
  lang: Lang;
  onSend: (a: Record<string, string>) => Promise<unknown>;
}) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    void onSend(Object.fromEntries(questions.map((q) => [q.key, String(v.get(q.key) ?? "").trim()])));
  }
  return (
    <form className={C.stack} onSubmit={submit} aria-label="Answer the worker">
      {questions.map((q) => {
        const text = questionText(lang, q.key);
        const id = ANSWER_ID + q.key;
        return (
          <label key={q.key} className={C.fieldLabel} htmlFor={id}>
            <span className={C.muted}>{t(lang, "job.asks", { question: text })}</span>
            {YES_NO_QUESTIONS.has(q.key) ? (
              <select id={id} className={C.field} name={q.key} aria-label={text} defaultValue={DetailFlag.enum.no}>
                {DetailFlag.options.map((f) => (
                  <option key={f} value={f}>
                    {t(lang, `flag.${f}`)}
                  </option>
                ))}
              </select>
            ) : (
              <input id={id} className={C.field} name={q.key} required aria-label={text} />
            )}
          </label>
        );
      })}
      <div>
        <button type={C.submit} className={C.btn}>
          {t(lang, "job.send_answers")}
        </button>
      </div>
    </form>
  );
}
