import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  GigSyncSpeech,
  type ListenOptions,
  type ListenResult,
  type SpeakOptions,
  type SpeechErrorCode,
  type SpeechLangOptions,
  type SpeechMode,
  type SpeechState,
  type SpeechStatus,
} from "@gigsync/plugin-speech";
import type { Lang } from "@gigsync/protocol";
import { cloudAllowed, readAloudWanted } from "./speech-settings.js";

/**
 * Voice for the screens, in the owner's language (spec §3.3, ADR 0023): speech to text on the device first, a cloud
 * recognizer only after the owner allowed that company, and reading aloud with local voices only. Screens use this
 * module, speech-settings.ts and `ui/Composer` / `ui/SpeakButton`, never the plugin. In development a scripted engine can stand in for the
 * plugin (speech-fake.ts), so UI tests can speak.
 */

/** What the adapter needs from an engine: the plugin, or in development the fake. */
export interface SpeechEngine {
  state(options: SpeechLangOptions): Promise<SpeechStatus>;
  prepare(options: SpeechLangOptions): Promise<SpeechStatus>;
  listen(options: ListenOptions, onPartial: (text: string) => void): Promise<ListenResult>;
  stop(): Promise<void>;
  speak(options: SpeakOptions): Promise<void>;
  stopSpeaking(): Promise<void>;
}

/** The engine states, as values. */
export const VoiceState = {
  available: "available",
  downloadable: "downloadable",
  downloading: "downloading",
  unavailable: "unavailable",
  denied: "denied",
} as const satisfies Record<SpeechState, SpeechState>;

/** Why listening was refused: the rejection's `code`. */
export const ListenRefusal = {
  unavailable: "unavailable",
  downloadable: "downloadable",
  denied: "denied",
  busy: "busy",
} as const satisfies Record<SpeechErrorCode, SpeechErrorCode>;

const Mode = { listen: "listen", speak: "speak" } as const satisfies Record<SpeechMode, SpeechMode>;

/** The engine name the plugin reports when nothing on this device can do it. */
const NO_ENGINE = "none";
const NONE: SpeechStatus = { state: VoiceState.unavailable, engine: NO_ENGINE };

/** The language's model or voice data can be fetched to this phone, or is on its way. */
export const waitsForDownload = (s: SpeechStatus | undefined) =>
  s?.state === VoiceState.downloadable || s?.state === VoiceState.downloading;
const PARTIAL = "partial";

/** Recognizers and voices go by locale; English tries India's first, then the US one most phones carry. */
const LOCALES: Readonly<Record<Lang, readonly [string, ...string[]]>> = {
  en: ["en-IN", "en-US"],
  hi: ["hi-IN"],
  kn: ["kn-IN"],
};

const device: SpeechEngine = {
  state: (o) => GigSyncSpeech.state(o),
  prepare: (o) => GigSyncSpeech.prepare(o),
  async listen(options, onPartial) {
    const words = await GigSyncSpeech.addListener(PARTIAL, (e) => onPartial(e.text));
    try {
      return await GigSyncSpeech.listen(options);
    } finally {
      await words.remove();
    }
  },
  stop: () => GigSyncSpeech.stop(),
  speak: (o) => GigSyncSpeech.speak(o),
  stopSpeaking: () => GigSyncSpeech.stopSpeaking(),
};

let chosenEngine: Promise<SpeechEngine> | undefined;
/** Release builds fold the DEV branch away, and the fake's module with it. */
function engine(): Promise<SpeechEngine> {
  chosenEngine ??= import.meta.env.DEV
    ? import("./speech-fake.js").then((m) => m.fakeSpeech() ?? device)
    : Promise.resolve(device);
  return chosenEngine;
}

/** An engine call whose failure changes nothing for the screen: a stop, or a download whose result is read next. */
async function quietly(work: (e: SpeechEngine) => Promise<unknown>): Promise<void> {
  try {
    await work(await engine());
  } catch {
    // Nothing was running, or the state read next tells the truth.
  }
}

interface Choice {
  locale: string;
  status: SpeechStatus;
}

/** Best first: works on the device, refused mic (the owner must hear why), a download away, then a cloud recognizer. */
const RANKS: readonly ((s: SpeechStatus) => boolean)[] = [
  (s) => s.state === VoiceState.available,
  (s) => s.state === VoiceState.denied,
  waitsForDownload,
  (s) => s.cloud !== undefined,
];

/** The language's best locale for listening or speaking; "unavailable" when the plugin is missing or fails. */
async function choose(lang: Lang, mode: SpeechMode): Promise<Choice> {
  const e = await engine();
  const tried = await Promise.all(
    LOCALES[lang].map(async (locale) => {
      try {
        return { locale, status: await e.state({ lang: locale, mode }) };
      } catch {
        return { locale, status: NONE };
      }
    }),
  );
  for (const fits of RANKS) {
    const best = tried.find((c) => fits(c.status));
    if (best) return best;
  }
  return tried[0] ?? { locale: LOCALES[lang][0], status: NONE };
}

/** Languages whose recognizers all refused this session (spec §3.3): the mic says "please type" until a restart. */
const refused = new Set<Lang>();
const listenChoices = new Map<Lang, Choice>();
const speakChoices = new Map<Lang, Promise<Choice>>();

export async function listenState(lang: Lang): Promise<SpeechStatus> {
  if (refused.has(lang)) return NONE;
  const choice = await choose(lang, Mode.listen);
  listenChoices.set(lang, choice);
  return choice.status;
}

export async function speakState(lang: Lang): Promise<SpeechStatus> {
  return (await speakChoice(lang, true)).status;
}

/** The language's voice, looked up once and kept, since every speaker button asks; `fresh` looks again. */
function speakChoice(lang: Lang, fresh = false): Promise<Choice> {
  const known = fresh ? undefined : speakChoices.get(lang);
  if (known) return known;
  const choice = choose(lang, Mode.speak);
  speakChoices.set(lang, choice);
  return choice;
}

/** Fetches the language's recognizer once. Only from the owner's tap. */
export async function prepareListen(lang: Lang): Promise<SpeechStatus> {
  const { locale } = listenChoices.get(lang) ?? (await choose(lang, Mode.listen));
  await quietly((e) => e.prepare({ lang: locale, mode: Mode.listen }));
  return listenState(lang);
}

/** Fetches the language's voice data once (Android opens its engine's install screen). Only from the owner's tap. */
export async function prepareSpeak(lang: Lang): Promise<SpeechStatus> {
  const { locale } = await speakChoice(lang);
  await quietly((e) => e.prepare({ lang: locale, mode: Mode.speak }));
  return speakState(lang);
}

/** The refusal code a failed `listen` carries, if it is one of the plugin's. */
export function refusalOf(e: unknown): SpeechErrorCode | undefined {
  const code = typeof e === "object" && e !== null && "code" in e ? e.code : undefined;
  return Object.values(ListenRefusal).find((c) => c === code);
}

/**
 * The final words heard, "" for nothing; words so far go to `onPartial`. Stops any speech first, so the app never
 * hears itself. A cloud recognizer is used only when the device has none ready and the owner allowed its company,
 * and never for an answer that must stay on the phone (`onDeviceOnly`: the lowest rate).
 */
export async function listen(
  lang: Lang,
  hints: readonly string[],
  onPartial: (text: string) => void,
  { onDeviceOnly = false }: { onDeviceOnly?: boolean } = {},
): Promise<string> {
  await stopSpeaking();
  const choice = listenChoices.get(lang) ?? (await choose(lang, Mode.listen));
  const vendor = choice.status.cloud?.vendor;
  const allowCloud =
    !onDeviceOnly &&
    choice.status.state !== VoiceState.available &&
    vendor !== undefined &&
    (await cloudAllowed(vendor));
  try {
    const heard = await (await engine()).listen({ lang: choice.locale, hints: [...hints], allowCloud }, onPartial);
    return heard.text;
  } catch (e) {
    listenChoices.delete(lang);
    // The device refused with no cloud to fall back on, or the cloud refused too: nothing is left to try. A refusal
    // for an on-device-only answer says nothing about the cloud the other questions may use.
    if (refusalOf(e) === ListenRefusal.unavailable && (allowCloud || vendor === undefined)) refused.add(lang);
    throw e;
  }
}

export function stopListening(): Promise<void> {
  return quietly((e) => e.stop());
}

/** Speaks now, for the owner's explicit tap. Rejects when there is no local voice for the language. */
export async function speak(lang: Lang, text: string): Promise<void> {
  const { locale } = await speakChoice(lang);
  await (await engine()).speak({ lang: locale, text });
}

export async function canSpeak(lang: Lang): Promise<boolean> {
  return (await speakChoice(lang)).status.state === VoiceState.available;
}

export function stopSpeaking(): Promise<void> {
  return quietly((e) => e.stopSpeaking());
}

/** Speaks only when reading aloud is on and a local voice exists. Never rejects. */
export async function readAloud(lang: Lang, text: string): Promise<void> {
  try {
    if ((await readAloudWanted()) && (await canSpeak(lang))) await speak(lang, text);
  } catch {
    // Not allowed before a tap on this page, or the voice went away: reading aloud helps, it never fails a screen.
  }
}

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
