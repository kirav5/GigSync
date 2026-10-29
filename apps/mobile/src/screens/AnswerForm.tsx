import { questionText, YES_NO_QUESTIONS } from "@gigsync/core";
import { AskKind, DetailFlag, isModelQuestion, type ModelQuestion, type Question, SKIPPED } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Said } from "../ui/Said.js";
import { SpeakButton } from "../ui/SpeakButton.js";

const ANSWER_ID = "answer-";
const QUESTION_ID_SUFFIX = "-question";
/** Digits in any script people type on Indian phones. */
const NUMBER_PATTERN = "[0-9०-९೦-೯]+";
/** The longest answer the protocol carries. */
const ANSWER_MAX = 300;
const A = AskKind.enum;

/** What a field starts with: a standard yes-or-no detail starts at no, as its toggle always did; the rest empty. */
const initial = (q: Question) => (!isModelQuestion(q) && YES_NO_QUESTIONS.has(q.key) ? DetailFlag.enum.no : "");

/** A written question's two answers, as two buttons; the chosen one is pressed. */
function YesNo({ q, value, onChange }: { q: ModelQuestion; value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className={C.actions} aria-labelledby={ANSWER_ID + q.key + QUESTION_ID_SUFFIX}>
      {DetailFlag.options.map((f) => (
        <button
          key={f}
          type={C.button}
          className={value === f ? C.accent : C.secondary}
          aria-pressed={value === f}
          onClick={() => onChange(f)}
        >
          {t(`flag.${f}`)}
        </button>
      ))}
    </fieldset>
  );
}

/** The input for one question: a standard key as it always was, a written one by its kind. */
function Input({ q, value, onChange }: { q: Question; value: string; onChange: (v: string) => void }) {
  const { lang, t } = useI18n();
  const id = ANSWER_ID + q.key;
  const change = (v: string) => onChange(v);
  if (!isModelQuestion(q)) {
    const text = questionText(lang, q.key);
    return YES_NO_QUESTIONS.has(q.key) ? (
      <select id={id} className={C.field} aria-label={text} value={value} onChange={(e) => change(e.target.value)}>
        {DetailFlag.options.map((f) => (
          <option key={f} value={f}>
            {t(`flag.${f}`)}
          </option>
        ))}
      </select>
    ) : (
      <input
        id={id}
        className={C.field}
        aria-label={text}
        value={value}
        maxLength={ANSWER_MAX}
        onChange={(e) => change(e.target.value)}
      />
    );
  }
  if (q.kind === A.yes_no) return <YesNo q={q} value={value} onChange={onChange} />;
  const number = q.kind === A.number;
  return (
    <input
      id={id}
      className={C.field}
      aria-labelledby={id + QUESTION_ID_SUFFIX}
      value={value}
      maxLength={ANSWER_MAX}
      onChange={(e) => change(e.target.value)}
      {...(number ? { inputMode: "numeric", pattern: NUMBER_PATTERN, placeholder: t("ask.number") } : {})}
    />
  );
}

/** One question, in this owner's language, with its input and a Skip that answers "skipped" for them. */
function Field({ q, value, onChange }: { q: Question; value: string; onChange: (v: string) => void }) {
  const { lang, t } = useI18n();
  const skipped = value === SKIPPED;
  const asked = isModelQuestion(q) ? (
    <Said text={q.text} from={q.lang} />
  ) : (
    t("job.asks", { question: questionText(lang, q.key) })
  );
  return (
    <div className={C.stack}>
      <label className={C.fieldLabel} htmlFor={ANSWER_ID + q.key}>
        <span className={C.muted} id={ANSWER_ID + q.key + QUESTION_ID_SUFFIX}>
          {asked}
        </span>
      </label>
      {skipped ? (
        <span className={C.faint}>{t("ask.skipped")}</span>
      ) : (
        <Input q={q} value={value} onChange={onChange} />
      )}
      <button
        type={C.button}
        className={C.quiet}
        aria-pressed={skipped}
        onClick={() => onChange(skipped ? initial(q) : SKIPPED)}
      >
        {t("ask.skip")}
      </button>
    </div>
  );
}

/**
 * The other side's agent's questions, in this owner's language: standard ones as they always were, a model's words
 * translated on this phone, yes-or-no as two buttons, a number as a number pad, the rest typed; each one skippable.
 * `say` names who is asking, shown and read aloud from the speaker button. Sending waits for every answer or skip.
 */
export function AnswerForm({
  questions,
  say,
  onSend,
}: {
  questions: Question[];
  say: string;
  onSend: (a: Record<string, string>) => Promise<unknown>;
}) {
  const { lang, t } = useI18n();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.key, initial(q)])),
  );
  const answered = (q: Question) => (values[q.key] ?? "").trim().length > 0;
  const ready = questions.every(answered);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ready) void onSend(Object.fromEntries(questions.map((q) => [q.key, (values[q.key] ?? "").trim()])));
  }
  return (
    <form className={C.stack} onSubmit={submit} aria-label={t("a11y.answer")}>
      <div className={C.row}>
        <SpeakButton lang={lang} text={say} />
        <span className={C.muted}>{say}</span>
      </div>
      {questions.map((q) => (
        <Field
          key={q.key}
          q={q}
          value={values[q.key] ?? ""}
          onChange={(v) => setValues((all) => ({ ...all, [q.key]: v }))}
        />
      ))}
      <div className={C.actions}>
        <button type={C.submit} className={C.btn} disabled={!ready}>
          {t("job.send_answers")}
        </button>
      </div>
    </form>
  );
}
