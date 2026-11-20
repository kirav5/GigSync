import type { SpeechStatus, SpeechVendor } from "@gigsync/plugin-speech";
import { type RefObject, useEffect, useRef, useState } from "react";
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

/** What the line above the field says after a listen that heard nothing or could not start. */
export const Note = {
  unheard: "speech.didnt_hear",
  unavailable: "speech.unavailable",
  denied: "speech.denied",
  /** The language's recognizer is on its way to the phone, fetched by the tap on the mic. */
  fetching: "speech.fetching",
  /** Only a company's recognizer exists, and this answer must stay on the phone. */
  private: "speech.type_private",
} as const;
export type Note = (typeof Note)[keyof typeof Note];

export interface ListenOptions {
  hints: readonly string[];
  onDeviceOnly: boolean;
  maxLength: number | undefined;
  /** The field: heard words fill it, and the cursor goes there when the mic can't help. */
  field: RefObject<HTMLInputElement | null>;
  setText: (text: string) => void;
  /** Heard words that fit, sent by themselves at the end of the listen. */
  onHeard: (text: string) => void;
}

/**
 * The composer's mic: listening, the line that says why it can't, the cloud consent and the mic explanation. The
 * mic's state is honest: "please type", or the phone's mic setting; a recognizer the phone can fetch is fetched by the
 * tap on the mic, never by a download button. Before the first listen that would go to a company's servers, the
 * composer asks (`asking`); before the first listen at all on a phone, it says why the phone will ask for the mic.
 */
export function useListen({ hints, onDeviceOnly, maxLength, field, setText, onHeard }: ListenOptions) {
  const { lang } = useI18n();
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useSpeechState(lang, listenState);
  const [note, setNote] = useState<Note>();
  const [asking, setAsking] = useState<SpeechVendor>();
  const [why, setWhy] = useState(false);
  /** Bumped by every listen and by leaving, cancelling or sending by hand; a listen whose number is stale is ignored. */
  const session = useRef(0);
  /**
   * The small mic's listen: the words go into the field after what was typed there, to read and change, and are sent
   * only by the owner. Kept in a ref, as the permission sheet's answer starts the listen without a tap on the mic.
   */
  const dictating = useRef(false);
  /** What the field held when a dictation began; the heard words follow it. */
  const kept = useRef("");
  const withKept = (words: string) => [kept.current, words].filter(Boolean).join(" ");

  // A fetch the line speaks of ends: ready, the mic works and the line clears; not coming, it says to type unless a
  // company's recognizer is left to ask about.
  useEffect(() => {
    if (note !== Note.fetching || !status || waitsForDownload(status)) return;
    const voiceLeft = status.state === VoiceState.available || (status.cloud !== undefined && !onDeviceOnly);
    setNote(voiceLeft ? undefined : Note.unavailable);
  }, [note, status, onDeviceOnly]);

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
    setText(kept.current);
    setListening(true);
    try {
      const heard = (
        await listen(
          lang,
          hints,
          (words) => {
            if (mine === session.current) setText(withKept(words));
          },
          { onDeviceOnly },
        )
      ).trim();
      if (mine !== session.current) return;
      setListening(false);
      if (dictating.current) return dictated(heard);
      const tooLong = maxLength !== undefined && heard.length > maxLength;
      setText(tooLong ? heard : "");
      if (!heard) setNote(Note.unheard);
      else if (!tooLong) onHeard(heard);
    } catch (e) {
      if (mine !== session.current) return;
      setListening(false);
      setText(kept.current);
      const code = refusalOf(e);
      if (code === ListenRefusal.denied) return setNote(Note.denied);
      if (code !== ListenRefusal.unavailable && code !== ListenRefusal.downloadable) return setNote(Note.unheard);
      const now = await listenState(lang);
      setStatus(now);
      await explain(now);
    }
  }

  /** A dictation ended: the words stay in the field, after what was typed, with the cursor there to change them. */
  function dictated(heard: string) {
    setText(withKept(heard));
    if (!heard) setNote(Note.unheard);
    field.current?.focus();
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

  /**
   * A mic while not listening: listen, or say why it can't. The round button's listen sends what it heard by itself;
   * `dictate` (the small mic) puts it in the field instead.
   */
  async function tapMic(dictate = false) {
    setAsking(undefined);
    dictating.current = dictate;
    kept.current = dictate ? (field.current?.value.trim() ?? "") : "";
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

  /** Done while listening: the words so far still come back from the listen, and are sent. */
  const finish = () => void stopListening();

  /** Lets the mic go and drops what it would still send: cancelled, or the field sent by hand mid-listen. */
  function release() {
    session.current += 1;
    setListening(false);
    void stopListening();
  }

  /** Cancel while listening: nothing is sent, and the field is empty again. */
  function cancel() {
    release();
    setText(kept.current);
    setNote(undefined);
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

  return {
    listening,
    status,
    note,
    setNote,
    asking,
    why,
    tapMic,
    finish,
    release,
    cancel,
    agree,
    decline,
    explained,
  };
}
