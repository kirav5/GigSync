import { asciiDigits, type MessageKey, NeedInput, type Prompt } from "@gigsync/core";
import { type FormEvent, useState } from "react";
import { useI18n } from "../../i18n.js";
import { Composer, type Via } from "../../ui/Composer.js";
import { C } from "../../ui/cls.js";
import { Dock } from "../../ui/Dock.js";
import "../../ui/composer.css";

const NUMERIC = "numeric";
const SEND = "send";
const NOT_A_DIGIT = /\D/g;
/** Why there is no field: no model at all (lite mode, or none to ask), so it is not said to be for a moment. */
const WHY = { chips: "need.no_typing", number: "need.no_typing_number" } as const satisfies Record<string, MessageKey>;
/** The same while GigSync's model is only paused, and asked again within the minute. */
const WHY_FOR_NOW = {
  chips: "need.typing_off",
  number: "need.typing_number",
} as const satisfies Record<string, MessageKey>;

/** A number and nothing else: the phone's number pad, and any other character dropped as it is typed. */
function NumberField({ busy, onSend }: { busy: boolean; onSend: (digits: string) => void }) {
  const { t } = useI18n();
  const [digits, setDigits] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!digits || busy) return;
    setDigits("");
    onSend(digits);
  }
  return (
    <form className="composer" aria-label={t("need.composer")} onSubmit={submit}>
      <div className="bar">
        <input
          value={digits}
          // Digits typed in Devanagari or Kannada count too, kept as the ones code reads.
          onChange={(e) => setDigits(asciiDigits(e.target.value).replace(NOT_A_DIGIT, ""))}
          placeholder={t("need.number_placeholder")}
          aria-label={t("need.number_placeholder")}
          autoComplete={C.off}
          enterKeyHint={SEND}
          inputMode={NUMERIC}
        />
        <button type={C.submit} className={SEND} disabled={busy || !digits} aria-label={t("a11y.send")}>
          →
        </button>
      </div>
    </form>
  );
}

interface Props {
  /** How the question now asked may be answered (core's `needInput`). */
  input: NeedInput;
  /** Typing is off only while GigSync's model is paused, so the line may say "for a moment". */
  backSoon: boolean;
  /** The question now asked, for what the mic should expect and whether the answer is private. */
  prompt: Prompt | undefined;
  busy: boolean;
  /** Words, typed or heard, while a model can read them. */
  onSend: (text: string, via: Via) => void;
  /** A number typed while no model reads: code reads it. */
  onNumber: (digits: string) => void;
}

/**
 * Where Find's answers are given, below the chat. With a model reading: the mic and the field. With none (ADR 0064:
 * the word lists never guess what a sentence means): no sentence is offered, by typing or by voice, since speech
 * becomes words that need reading too; one line says why, and a question whose answer is a number keeps a number field.
 */
export function NeedDock({ input, backSoon, prompt, busy, onSend, onNumber }: Props) {
  const { t } = useI18n();
  if (input === NeedInput.words)
    return (
      <Dock>
        <Composer
          label={t("need.composer")}
          placeholder={t("need.placeholder")}
          onSend={onSend}
          busy={busy}
          hints={prompt?.hints ?? []}
          numeric={prompt?.numeric ?? false}
          onDeviceOnly={prompt?.secret ?? false}
        />
      </Dock>
    );
  const number = input === NeedInput.number;
  const why = backSoon ? WHY_FOR_NOW : WHY;
  return (
    <Dock>
      <p className={C.dockStatus} role="status" aria-live="polite">
        {t(number ? why.number : why.chips)}
      </p>
      {number && <NumberField busy={busy} onSend={onNumber} />}
    </Dock>
  );
}
