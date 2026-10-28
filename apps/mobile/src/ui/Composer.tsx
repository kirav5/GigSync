import { type FormEvent, useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";

/** How the words came in: heard by the mic, or typed. */
export const Via = { voice: "voice", typed: "typed" } as const;
export type Via = (typeof Via)[keyof typeof Via];

export interface ComposerProps {
  /** Accessible name of the form. */
  label: string;
  placeholder: string;
  /** Final words, typed or heard; the composer clears itself afterwards. */
  onSend: (text: string, via: Via) => void;
  busy?: boolean;
  /** Words the recognizer should expect for the current question. */
  hints?: readonly string[];
  /** True while the question is an amount: the phone shows a number pad. */
  numeric?: boolean;
}

const NUMERIC = "numeric";

/** Where the owner answers, by voice or by typing. Until the speech engine lands, the field and send only. */
export function Composer({ label, placeholder, onSend, busy = false, numeric = false }: ComposerProps) {
  const { t } = useI18n();
  const [text, setText] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const words = text.trim();
    if (!words || busy) return;
    setText("");
    onSend(words, Via.typed);
  }

  return (
    <form className="composer" aria-label={label} onSubmit={submit}>
      <div className="bar">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoComplete={C.off}
          inputMode={numeric ? NUMERIC : undefined}
        />
        <button type={C.submit} className="send" disabled={busy || !text.trim()} aria-label={t("a11y.send")}>
          →
        </button>
      </div>
    </form>
  );
}
