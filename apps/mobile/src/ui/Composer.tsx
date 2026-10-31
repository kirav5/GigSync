import type { SpeechStatus, SpeechVendor } from "@gigsync/plugin-speech";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { needsExplaining, Permission } from "../adapters/permissions.js";
import {
  ListenRefusal,
  listen,
  listenState,
  prepareListen,
  refusalOf,
  stopListening,
  VoiceState,
  waitsForDownload,
} from "../adapters/speech.js";
import { allowCloud, cloudAllowed } from "../adapters/speech-settings.js";
import { useSpeechState } from "../adapters/speech-watch.js";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";
import { Icon } from "./Icon.js";
import { PermissionSheet } from "./PermissionSheet.js";
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

/** What the line above the field says after a listen that heard nothing or could not start. */
const Note = {
  unheard: "speech.didnt_hear",
  unavailable: "speech.unavailable",
  denied: "speech.denied",
  /** The language's recognizer is on its way to the phone, fetched by the tap on the mic. */
  fetching: "speech.fetching",
  /** Only a company's recognizer exists, and this answer must stay on the phone. */
  private: "speech.type_private",
} as const;
type Note = (typeof Note)[keyof typeof Note];

const NUMERIC = "numeric";
const SEND = "send";
const NO_HINTS: readonly string[] = [];

/**
 * Where the owner answers: a big mic first, then the field and send (spec §3.3). Heard words fill the field while the
 * owner speaks (it is read-only then, so typing is never overwritten) and are sent by themselves at the end, because
 * many owners cannot proofread and every answer is read back. The mic's state is honest: "please type", or the
 * phone's mic setting; a recognizer the phone can fetch is fetched by the tap on the mic, never by a download button.
 * Before the first listen that would go to a company's servers, a sheet asks; before the first listen at all on a
 * phone, a sheet says in the app's language why the phone is about to ask for the mic.
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
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useSpeechState(lang, listenState);
  const [note, setNote] = useState<Note>();
  const [asking, setAsking] = useState<SpeechVendor>();
  const [why, setWhy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const allow = useRef<HTMLButtonElement>(null);
  /** Bumped by every listen and by leaving or sending by hand; a listen whose number is stale is ignored. */
  const session = useRef(0);
  const askId = useId();
  const langName = t(`lang.${lang}`);
  const vendorName = status?.cloud ? t(`speech.vendor_${status.cloud.vendor}`) : "";

  // A fetch the line speaks of ends: ready, the mic works and the line clears; not coming, it says to type unless a
  // company's recognizer is left to ask about.
  useEffect(() => {
    if (note !== Note.fetching || !status || waitsForDownload(status)) return;
    const voiceLeft = status.state === VoiceState.available || (status.cloud !== undefined && !onDeviceOnly);
    setNote(voiceLeft ? undefined : Note.unavailable);
  }, [note, status, onDeviceOnly]);

  // The consent sheet takes focus when it opens, so a screen reader says the question and lands on its answer.
  useEffect(() => {
    if (asking) allow.current?.focus();
  }, [asking]);

  // Leaving the screen while listening lets the mic go and drops whatever it would still send.
  useEffect(
    () => () => {
      session.current += 1;
      void stopListening();
    },
    [],
  );

  /** Listens, once the owner has heard why the phone is about to ask for the microphone. */
  async function start() {
    if (await needsExplaining(Permission.mic).catch(() => false)) return setWhy(true);
    return hear();
  }

  async function hear() {
    const mine = ++session.current;
    setNote(undefined);
    setText("");
    setListening(true);
    try {
      const heard = (
        await listen(
          lang,
          hints,
          (words) => {
            if (mine === session.current) setText(words);
          },
          { onDeviceOnly },
        )
      ).trim();
      if (mine !== session.current) return;
      setListening(false);
      const tooLong = maxLength !== undefined && heard.length > maxLength;
      setText(tooLong ? heard : "");
      if (!heard) setNote(Note.unheard);
      else if (!tooLong) onSend(heard, Via.voice);
    } catch (e) {
      if (mine !== session.current) return;
      setListening(false);
      setText("");
      const code = refusalOf(e);
      if (code === ListenRefusal.denied) return setNote(Note.denied);
      if (code !== ListenRefusal.unavailable && code !== ListenRefusal.downloadable) return setNote(Note.unheard);
      const now = await listenState(lang);
      setStatus(now);
      await explain(now);
    }
  }

  /** The mic can't help now: say why, and put the cursor in the field. */
  function typeInstead(why: Note) {
    setNote(why);
    field.current?.focus();
  }

  /** Says why the mic can't listen now, without listening: the setting, the fetch, the consent, or "please type". */
  async function explain(s: SpeechStatus) {
    if (s.state === VoiceState.denied) return setNote(Note.denied);
    if (waitsForDownload(s)) return fetchRecognizer(s);
    const vendor = s.cloud?.vendor;
    if (vendor && onDeviceOnly) return typeInstead(Note.private);
    if (!vendor) return typeInstead(Note.unavailable);
    if (await cloudAllowed(vendor)) return setNote(Note.unheard);
    setNote(undefined);
    setAsking(vendor);
  }

  /** The recognizer can come to this phone: fetched in this tap (engines need one), with the field ready meanwhile. */
  async function fetchRecognizer(s: SpeechStatus) {
    typeInstead(Note.fetching);
    setStatus(s.state === VoiceState.downloadable ? await prepareListen(lang) : s);
  }

  async function tapMic() {
    if (listening) {
      // The words so far still come back, and are sent.
      await stopListening();
      return;
    }
    if (busy) return;
    setAsking(undefined);
    // Anything short of ready is asked again: the periodic check may not have seen a fetch that has just arrived, and
    // a tap then would only explain instead of listening.
    const s = status?.state === VoiceState.available ? status : await listenState(lang);
    // Kept, so what the line says names the right company.
    if (s !== status) setStatus(s);
    const vendor = s.cloud?.vendor;
    if (s.state === VoiceState.available) return start();
    if (!onDeviceOnly && s.state !== VoiceState.denied && vendor && (await cloudAllowed(vendor))) return start();
    return explain(s);
  }

  function agree(vendor: SpeechVendor) {
    allowCloud(vendor);
    setAsking(undefined);
    // Asked before the private question came up: allowed for the others, but this answer is still typed.
    if (onDeviceOnly) return typeInstead(Note.private);
    void start();
  }

  function decline() {
    setAsking(undefined);
    field.current?.focus();
  }

  /** The permission sheet's answer: on to the phone's own prompt, or the field. */
  function explained(go: boolean) {
    setWhy(false);
    if (go) void hear();
    else field.current?.focus();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const words = text.trim();
    if (!words || busy || (maxLength !== undefined && words.length > maxLength)) return;
    const via = listening ? Via.voice : Via.typed;
    if (listening) {
      // Sent by hand mid-listen: what the field shows goes, and the recognizer's last words are dropped.
      session.current += 1;
      setListening(false);
      void stopListening();
    }
    setText("");
    setNote(undefined);
    onSend(words, via);
  }

  const off = !listening && status?.state === VoiceState.unavailable && (!status.cloud || onDeviceOnly);
  return (
    <form className="composer" aria-label={label} onSubmit={submit}>
      <p className={C.dockStatus} role="status" aria-live="polite">
        {listening ? t("speech.listening") : note ? t(note, { lang: langName, vendor: vendorName }) : ""}
      </p>
      {asking && (
        <div className="composer-sheet" role="dialog" aria-labelledby={askId}>
          <p id={askId}>{t("speech.cloud_ask", { lang: langName, vendor: t(`speech.vendor_${asking}`) })}</p>
          <div className={C.actions}>
            <button ref={allow} type={C.button} className={C.accent} onClick={() => agree(asking)}>
              {t("speech.cloud_yes")}
            </button>
            <button type={C.button} className={C.secondary} onClick={decline}>
              {t("speech.cloud_no")}
            </button>
          </div>
        </div>
      )}
      {why && <PermissionSheet permission={Permission.mic} onAnswer={explained} />}
      <div className="composer-row">
        <button
          type={C.button}
          className="composer-mic"
          data-listening={listening || undefined}
          data-off={off || undefined}
          disabled={busy && !listening}
          aria-label={listening ? t("speech.stop") : t("speech.listen")}
          onClick={() => void tapMic()}
        >
          <Icon name={listening ? "stop" : "mic"} size={26} />
        </button>
        <div className="bar">
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
          <button type={C.submit} className={SEND} disabled={busy || !text.trim()} aria-label={t("a11y.send")}>
            →
          </button>
        </div>
      </div>
    </form>
  );
}
