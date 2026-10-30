import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { SpeechStatus } from "@gigsync/plugin-speech";
import type { Lang } from "@gigsync/protocol";
import { type Dispatch, type SetStateAction, useEffect, useState, useSyncExternalStore } from "react";
import { recheckVoices, VoiceState, voicesChanged } from "./speech.js";

/**
 * Speech states as the mic and the speaker buttons follow them: a download the phone finishes in the background, and
 * every return to the front, when a recognizer or voice installed meanwhile (from Android's own screen) shows up
 * without a restart.
 */

/** How often a language download the phone finishes in the background is checked on. */
const DOWNLOAD_POLL_MS = 3000;
/** Checking on a timer stops after this long; coming back to the app still checks. */
const DOWNLOAD_WATCH_MS = 15 * 60 * 1000;
const RESUME = "resume";
const VISIBILITY = "visibilitychange";

/** Calls `fn` each time the app comes back to the front: Capacitor's resume on a phone, the page shown on the web. */
function onReturn(fn: () => void): () => void {
  if (Capacitor.isNativePlatform()) {
    const listening = App.addListener(RESUME, fn);
    return () => void listening.then((l) => l.remove());
  }
  const shown = () => {
    if (!document.hidden) fn();
  };
  document.addEventListener(VISIBILITY, shown);
  return () => document.removeEventListener(VISIBILITY, shown);
}

/**
 * Follows a download the phone finishes in the background (round2-spec §1.5): re-reads the state with `read` every
 * DOWNLOAD_POLL_MS for at most DOWNLOAD_WATCH_MS, and whenever the app comes back to the front, until it is no longer
 * downloading; then hands the new state to `onChange` once and stops. Returns a stop function for a screen that goes
 * away first. A read that fails is tried again at the next check.
 */
export function watchDownload(read: () => Promise<SpeechStatus>, onChange: (s: SpeechStatus) => void): () => void {
  let stopped = false;
  const check = async () => {
    try {
      const now = await read();
      if (stopped || now.state === VoiceState.downloading) return;
      stop();
      onChange(now);
    } catch {
      // The next check reads again.
    }
  };
  const poll = setInterval(() => void check(), DOWNLOAD_POLL_MS);
  const deadline = setTimeout(() => clearInterval(poll), DOWNLOAD_WATCH_MS);
  const forget = onReturn(() => void check());
  function stop() {
    stopped = true;
    clearInterval(poll);
    clearTimeout(deadline);
    forget();
  }
  return stop;
}

let followers = 0;
let stopFollowing: (() => void) | undefined;

/**
 * Screens follow `voicesChanged`; while any does, one listener also reads the speech states again each time the app
 * comes back to the front.
 */
function subscribe(fn: () => void): () => void {
  const unsubscribe = voicesChanged.subscribe(fn);
  followers += 1;
  stopFollowing ??= onReturn(() => void recheckVoices());
  return () => {
    unsubscribe();
    followers -= 1;
    if (followers > 0) return;
    stopFollowing?.();
    stopFollowing = undefined;
  };
}

/**
 * A speech state for one screen: `read` for `lang` now, after any fetch and after each return to the front; `fresh`
 * while a download runs (by default `read` again; a cached `read` needs a fresh one to see the download end).
 */
export function useSpeechState(
  lang: Lang,
  read: (lang: Lang) => Promise<SpeechStatus>,
  fresh: (lang: Lang) => Promise<SpeechStatus> = read,
): readonly [SpeechStatus | undefined, Dispatch<SetStateAction<SpeechStatus | undefined>>] {
  const [status, setStatus] = useState<SpeechStatus>();
  const round = useSyncExternalStore(subscribe, voicesChanged.version);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `round` only exists to read again.
  useEffect(() => {
    let live = true;
    void read(lang).then((s) => {
      if (live) setStatus(s);
    });
    return () => {
      live = false;
    };
  }, [lang, read, round]);
  // A download finishing in the background shows up by itself (round2-spec §1.5).
  const downloading = status?.state === VoiceState.downloading;
  useEffect(() => (downloading ? watchDownload(() => fresh(lang), setStatus) : undefined), [downloading, fresh, lang]);
  return [status, setStatus];
}
