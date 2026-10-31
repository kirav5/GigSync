import type { SpeechLangOptions, SpeechMode, SpeechStatus } from "@gigsync/plugin-speech";
import { ListenRefusal, type SpeechEngine, VoiceState } from "./speech.js";

/**
 * DEV ONLY: a scripted speech engine for the UI tests (spec §3.3, amendment A1). It is active when
 * localStorage["gigsync-fake-speech"] holds a JSON array of strings, and each listen takes the next one.
 * localStorage["gigsync-fake-speech-mode"] picks what the phone can do: absent, listening works on the device;
 * "cloud", only a cloud recognizer exists, so the consent sheet shows; "none", nothing listens at all;
 * "downloadable", the recognizer and the voice download once fetched during a tap, ready FETCH_MS later and until the
 * page reloads; "unfetchable", they are offered but a fetch never brings them. In both, a "mode:locale" listed in
 * localStorage["gigsync-fake-speech-installed"] is on the phone, as if installed outside the app. Each fetch is
 * logged to localStorage["gigsync-fake-speech-fetches"] with whether it came during a tap, and each text read aloud
 * to localStorage["gigsync-fake-speech-said"]. Otherwise reading aloud always has a voice and finishes at once.
 * speech.ts loads this module only under import.meta.env.DEV, so release builds never contain it.
 */
const QUEUE_KEY = "gigsync-fake-speech";
const MODE_KEY = "gigsync-fake-speech-mode";
const FETCHES_KEY = "gigsync-fake-speech-fetches";
const SAID_KEY = "gigsync-fake-speech-said";
const INSTALLED_KEY = "gigsync-fake-speech-installed";
const FakeMode = { cloud: "cloud", none: "none", downloadable: "downloadable", unfetchable: "unfetchable" } as const;
/** How long a fetched recognizer or voice takes to arrive, so a screen shows the wait. */
const FETCH_MS = 1500;
const LISTEN = "listen" satisfies SpeechMode;
const SPEAK = "speak" satisfies SpeechMode;
const ENGINE = "fake";
const CLOUD: NonNullable<SpeechStatus["cloud"]> = { engine: "fake-cloud", vendor: "google" };
const READY: SpeechStatus = { state: VoiceState.available, engine: ENGINE };

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const isWords = (v: unknown): v is string[] => Array.isArray(v) && v.every((w) => typeof w === "string");

function answers(): string[] | undefined {
  try {
    const queue: unknown = JSON.parse(stored(QUEUE_KEY) ?? "null");
    return isWords(queue) ? queue : undefined;
  } catch {
    return undefined;
  }
}

/** Whether "mode:locale" was installed outside the app, as a test says. */
function installed(key: string): boolean {
  try {
    const list: unknown = JSON.parse(stored(INSTALLED_KEY) ?? "[]");
    return Array.isArray(list) && list.includes(key);
  } catch {
    return false;
  }
}

/** Adds `entry` to the JSON list a test reads under `key`. */
function logTo(key: string, entry: unknown): void {
  try {
    const list: unknown = JSON.parse(stored(key) ?? "[]");
    localStorage.setItem(key, JSON.stringify([...(Array.isArray(list) ? list : []), entry]));
  } catch {
    // A test that reads nothing fails on its own.
  }
}

function listening(mode: string | null): SpeechStatus {
  if (mode === FakeMode.cloud) return { state: VoiceState.unavailable, engine: ENGINE, cloud: CLOUD };
  if (mode === FakeMode.none) return { state: VoiceState.unavailable, engine: ENGINE };
  return READY;
}

/** Real engines download only during the owner's tap; a browser without the API is taken as in one. */
const inTap = () => navigator.userActivation?.isActive ?? true;

/**
 * The recognizer and the voice for a phone that must fetch them: downloadable until a tap fetches one, then on its
 * way for FETCH_MS, then ready. A phone where the fetch never brings them stays downloadable.
 */
function downloads(arrives: boolean) {
  const readyAt = new Map<string, number>();
  const keyOf = ({ lang, mode }: SpeechLangOptions) => `${mode}:${lang}`;
  const state = (o: SpeechLangOptions): SpeechStatus => {
    if (installed(keyOf(o))) return READY;
    const at = readyAt.get(keyOf(o));
    if (at === undefined) return { state: VoiceState.downloadable, engine: ENGINE };
    return at <= Date.now() ? READY : { state: VoiceState.downloading, engine: ENGINE };
  };
  const prepare = (o: SpeechLangOptions): SpeechStatus => {
    const tapped = inTap();
    logTo(FETCHES_KEY, { lang: o.lang, mode: o.mode, tapped });
    if (arrives && tapped && !readyAt.has(keyOf(o))) readyAt.set(keyOf(o), Date.now() + FETCH_MS);
    return state(o);
  };
  return { state, prepare };
}

/** What the engine says about each language, and what fetching does. */
function phone(mode: string | null) {
  if (mode === FakeMode.downloadable || mode === FakeMode.unfetchable) return downloads(mode === FakeMode.downloadable);
  const status = listening(mode);
  const state = ({ mode }: SpeechLangOptions) => (mode === LISTEN ? status : READY);
  return { state, prepare: state };
}

/** The fake engine, or undefined when no test asked for one. */
export function fakeSpeech(): SpeechEngine | undefined {
  const queue = answers();
  if (!queue) return undefined;
  const { state, prepare } = phone(stored(MODE_KEY));
  return {
    state: async (o) => state(o),
    prepare: async (o) => prepare(o),
    async listen({ lang, allowCloud = false }, onPartial) {
      const status = state({ lang, mode: LISTEN });
      const onDevice = status.state === VoiceState.available;
      if (!onDevice && !(allowCloud && status.cloud)) {
        throw Object.assign(new Error("fake: no recognizer"), { code: ListenRefusal.unavailable });
      }
      const text = queue.shift() ?? "";
      if (text) onPartial(text);
      return { text, engine: onDevice ? ENGINE : CLOUD.engine, onDevice };
    },
    stop: async () => {},
    async speak({ lang, text }) {
      if (state({ lang, mode: SPEAK }).state !== VoiceState.available) {
        throw Object.assign(new Error("fake: no voice"), { code: ListenRefusal.unavailable });
      }
      logTo(SAID_KEY, text);
    },
    stopSpeaking: async () => {},
  };
}
