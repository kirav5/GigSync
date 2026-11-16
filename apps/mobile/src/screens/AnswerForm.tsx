import { questionText, type Suggested, YES_NO_QUESTIONS } from "@gigsync/core";
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
const blank = (q: Question) => (!isModelQuestion(q) && YES_NO_QUESTIONS.has(q.key) ? DetailFlag.enum.no : "");

/** A field starts with the answer the agent remembers, when it holds one for the owner; else blank. */
const initial = (q: Question, suggested: Suggested | undefined) => suggested?.text ?? blank(q);

/** "From your past jobs: 2. Send this?", or "still right?" for one given a year or more ago, with Change. */
function Remembered({ suggested, onChange }: { suggested: Suggested; onChange: () => void }) {
  const { t } = useI18n();
  const flag = DetailFlag.safeParse(suggested.text);
  const value = flag.success ? t(`flag.${flag.data}`) : suggested.text;
  return (
    <>
      <span>{t(suggested.fresh ? "ask.memory_offer" : "ask.memory_old", { value })}</span>
      <button type={C.button} className={C.quiet} onClick={onChange}>
        {t("ask.change")}
      </button>
    </>
  );
}

/** A written question's two answers, as two chips side by side (H7); the chosen one is pressed. */
function YesNo({ q, value, onChange }: { q: ModelQuestion; value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className={C.row} aria-labelledby={ANSWER_ID + q.key + QUESTION_ID_SUFFIX}>
      {DetailFlag.options.map((f) => (
        <button
          key={f}
          type={C.button}
          className={value === f ? C.chipOn : C.chip}
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

interface FieldProps {
  q: Question;
  value: string;
  onChange: (v: string) => void;
  suggested: Suggested | undefined;
}

/**
 * One question, in this owner's language, with its input and a Skip that answers "skipped" for them. A remembered
 * answer shows as a line to send as it is, until Change opens the input with it.
 */
function Field({ q, value, onChange, suggested }: FieldProps) {
  const { lang, t } = useI18n();
  const [changing, setChanging] = useState(false);
  const skipped = value === SKIPPED;
  const offered = suggested !== undefined && !changing && value === suggested.text;
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
      {skipped && <span className={C.faint}>{t("ask.skipped")}</span>}
      {offered && <Remembered suggested={suggested} onChange={() => setChanging(true)} />}
      {!skipped && !offered && <Input q={q} value={value} onChange={onChange} />}
      <button
        type={C.button}
        className={C.quiet}
        aria-pressed={skipped}
        onClick={() => onChange(skipped ? initial(q, suggested) : SKIPPED)}
      >
        {t("ask.skip")}
      </button>
    </div>
  );
}

/**
 * The other side's agent's questions, in this owner's language: standard ones as they always were, a model's words
 * translated on this phone, yes-or-no as two chips, a number as a number pad, the rest typed; each one skippable.
 * `say` names who is asking, shown as the card's label and read aloud from the speaker button. Answers the agent
 * remembers from past jobs (`suggested`, when the owner chose "Ask me first") come filled in, so one tap sends them.
 * Sending waits for every answer or skip.
 */
export function AnswerForm({
  questions,
  say,
  suggested = {},
  onSend,
}: {
  questions: Question[];
  say: string;
  suggested?: Readonly<Record<string, Suggested>> | undefined;
  onSend: (a: Record<string, string>) => void;
}) {
  const { lang, t } = useI18n();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.key, initial(q, suggested[q.key])])),
  );
  const answered = (q: Question) => (values[q.key] ?? "").trim().length > 0;
  const ready = questions.every(answered);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ready) onSend(Object.fromEntries(questions.map((q) => [q.key, (values[q.key] ?? "").trim()])));
  }
  return (
    <form className={C.stack} onSubmit={submit} aria-label={t("a11y.answer")}>
      <div className="answer-head">
        <p className="answer-say">{say}</p>
        <SpeakButton lang={lang} text={say} />
      </div>
      {questions.map((q) => (
        <Field
          key={q.key}
          q={q}
          value={values[q.key] ?? ""}
          suggested={suggested[q.key]}
          onChange={(v) => setValues((all) => ({ ...all, [q.key]: v }))}
        />
      ))}
      <button type={C.submit} className={`${C.btn} wide`} disabled={!ready}>
        {t("job.send_answers")}
      </button>
    </form>
  );
}
