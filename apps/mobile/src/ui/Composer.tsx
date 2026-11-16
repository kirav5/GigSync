import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Permission } from "../adapters/permissions.js";
import { VoiceState } from "../adapters/speech.js";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";
import { Icon } from "./Icon.js";
import { ListeningSheet } from "./ListeningSheet.js";
import { PermissionSheet } from "./PermissionSheet.js";
import { useListen } from "./useListen.js";
import "./composer.css";

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
  /** True while the answer is private (the lowest rate): only a recognizer on the phone may hear it, never a company's. */
  onDeviceOnly?: boolean;
  /** The longest message the receiver accepts; longer words stay in the field to shorten, typed or heard. */
  maxLength?: number;
}

const NUMERIC = "numeric";
const SEND = "send";
const ROUND = "composer-voice";
/** The plain round icons in the pill: the "+" and the small mic. */
const ICON_BTN = "composer-icon";
/** The round button's icon. */
const ICON_PX = 24;
/** The small mic's icon, beside the round button. */
const MIC_PX = 20;
const NO_HINTS: readonly string[] = [];

/**
 * Where the owner answers (spec §3.3, the design's Home), the same pill on every chat: the field, a small mic that types by voice into the field (to read and change, sent only by the owner), and
 * at its end one round warm button: voice, which listens and sends by itself when the owner stops, because many owners
 * cannot proofread and every answer is read back. As in Gemini, that round button turns into send (an up arrow) once
 * something is typed, and the keyboard's Enter sends too. While either mic listens the listening sheet rises over the chat with
 * the words as they come (the field holds them too, read-only, so typing is never overwritten); its × drops them and
 * Done ends the listen. What the mic can and cannot do lives in `useListen`.
 */
export function Composer({
  label,
  placeholder,
  onSend,
  busy = false,
  hints = NO_HINTS,
  numeric = false,
  onDeviceOnly = false,
  maxLength,
}: ComposerProps) {
  const { lang, t } = useI18n();
  const [text, setText] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const allow = useRef<HTMLButtonElement>(null);
  const askId = useId();
  const mic = useListen({
    hints,
    onDeviceOnly,
    maxLength,
    field,
    setText,
    onHeard: (heard) => onSend(heard, Via.voice),
  });
  const { listening, status, note, asking } = mic;
  const langName = t(`lang.${lang}`);
  const vendorName = status?.cloud ? t(`speech.vendor_${status.cloud.vendor}`) : "";

  // The consent sheet takes focus when it opens, so a screen reader says the question and lands on its answer.
  useEffect(() => {
    if (asking) allow.current?.focus();
  }, [asking]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const words = text.trim();
    if (!words || busy || (maxLength !== undefined && words.length > maxLength)) return;
    const via = listening ? Via.voice : Via.typed;
    // Sent by hand mid-listen: what the field shows goes, and the recognizer's last words are dropped.
    if (listening) mic.release();
    setText("");
    mic.setNote(undefined);
    onSend(words, via);
  }

  const off = !listening && status?.state === VoiceState.unavailable && (!status.cloud || onDeviceOnly);
  // As in Gemini, the round button is voice until something is typed, then send. Heard words never need send: they
  // send themselves (or Done sends them).
  const typed = !listening && Boolean(text.trim());
  const tooLong = maxLength !== undefined && text.trim().length > maxLength;
  return (
    <form className="composer" aria-label={label} onSubmit={submit}>
      <p className={C.dockStatus} role="status" aria-live="polite">
        {!listening && note ? t(note, { lang: langName, vendor: vendorName }) : ""}
      </p>
      {asking && (
        <div className="composer-sheet" role="dialog" aria-labelledby={askId}>
          <p id={askId}>{t("speech.cloud_ask", { lang: langName, vendor: t(`speech.vendor_${asking}`) })}</p>
          <div className={C.actions}>
            <button ref={allow} type={C.button} className={C.accent} onClick={() => mic.agree(asking)}>
              {t("speech.cloud_yes")}
            </button>
            <button type={C.button} className={C.secondary} onClick={mic.decline}>
              {t("speech.cloud_no")}
            </button>
          </div>
        </div>
      )}
      {mic.why && <PermissionSheet permission={Permission.mic} onAnswer={mic.explained} />}
      {listening && <ListeningSheet heard={text} onDone={mic.finish} onCancel={mic.cancel} />}
      <div className="composer-row">
        <input
          ref={field}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete={C.off}
          enterKeyHint={SEND}
          inputMode={numeric ? NUMERIC : undefined}
          readOnly={listening}
          maxLength={maxLength}
        />
        <button
          type={C.button}
          className={ICON_BTN}
          data-off={off || undefined}
          disabled={busy}
          aria-label={t("composer.dictate")}
          onClick={() => void mic.tapMic(true)}
        >
          <Icon name="mic" size={MIC_PX} />
        </button>
        {typed ? (
          <button type={C.submit} className={ROUND} disabled={busy || tooLong} aria-label={t("a11y.send")}>
            <Icon name="send" size={ICON_PX} />
          </button>
        ) : (
          <button
            type={C.button}
            className={ROUND}
            data-off={off || undefined}
            disabled={busy}
            aria-label={t("speech.listen")}
            onClick={() => void mic.tapMic()}
          >
            <Icon name="wave" size={ICON_PX} />
          </button>
        )}
      </div>
    </form>
  );
}
