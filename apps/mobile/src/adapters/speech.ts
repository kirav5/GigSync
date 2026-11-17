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
import { cloudAllowed } from "./speech-settings.js";

/**
 * Voice for the screens, in the owner's language (spec §3.3, ADR 0023): speech to text on the device first, a cloud
 * recognizer only after the owner allowed that company, and reading aloud with local voices only. The recognizer and
 * voice are fetched by themselves (from the mic's or speaker's tap), never from a download link.
 * Screens use this module, speech-settings.ts, speech-watch.ts and `ui/Composer` / `ui/SpeakButton`, never the
 * plugin. In development a scripted engine can stand in for the plugin (speech-fake.ts), so UI tests can speak.
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
/** Downloads asked of the engine since the app opened, as "mode:lang"; like translation packs (translate.ts). */
const fetched = new Set<string>();
const fetchKey = (lang: Lang, mode: SpeechMode) => `${mode}:${lang}`;

/** Bumped whenever a fetch ends or the states are read again, so every screen showing voice asks again. */
let rounds = 0;
const changed = new Set<() => void>();
export const voicesChanged = {
  subscribe(fn: () => void) {
    changed.add(fn);
    return () => {
      changed.delete(fn);
    };
  },
  version: () => rounds,
};

/** Hands `now` back after telling every screen showing voice to read its state again. */
function announce<T>(now: T): T {
  rounds += 1;
  for (const fn of changed) fn();
  return now;
}

/**
 * A download already asked for that never started is not coming: the screens treat it as no voice at all. One found
 * on the phone after all (installed from Android's own screen) loses the mark, so a later loss can be fetched again.
 */
function settled(lang: Lang, mode: SpeechMode, status: SpeechStatus): SpeechStatus {
  const key = fetchKey(lang, mode);
  if (status.state === VoiceState.available) fetched.delete(key);
  const gaveUp = status.state === VoiceState.downloadable && fetched.has(key);
  return gaveUp ? { ...status, state: VoiceState.unavailable } : status;
}

export async function listenState(lang: Lang): Promise<SpeechStatus> {
  if (refused.has(lang)) return NONE;
  const choice = await choose(lang, Mode.listen);
  listenChoices.set(lang, choice);
  return settled(lang, Mode.listen, choice.status);
}

export async function speakState(lang: Lang): Promise<SpeechStatus> {
  return settled(lang, Mode.speak, (await speakChoice(lang, true)).status);
}

/** The language's voice for a speaker button: looked up once and kept, since every button asks. */
export async function knownVoice(lang: Lang): Promise<SpeechStatus> {
  return settled(lang, Mode.speak, (await speakChoice(lang)).status);
}

/** The language's voice, looked up once and kept; `fresh` looks again. */
function speakChoice(lang: Lang, fresh = false): Promise<Choice> {
  const known = fresh ? undefined : speakChoices.get(lang);
  if (known) return known;
  const choice = choose(lang, Mode.speak);
  speakChoices.set(lang, choice);
  return choice;
}

/** Asks the engine for a recognizer or voice. Engines download only during the owner's tap, so callers run in one. */
async function fetchVoice(lang: Lang, mode: SpeechMode, locale: string): Promise<void> {
  fetched.add(fetchKey(lang, mode));
  await quietly((e) => e.prepare({ lang: locale, mode }));
}

/** Fetches the language's recognizer, from the owner's tap on the mic or on a language. */
export async function prepareListen(lang: Lang): Promise<SpeechStatus> {
  const { locale } = listenChoices.get(lang) ?? (await choose(lang, Mode.listen));
  await fetchVoice(lang, Mode.listen, locale);
  return announce(await listenState(lang));
}

/** Fetches the language's voice data (Android opens its engine's install screen), from the owner's speaker tap. */
export async function prepareSpeak(lang: Lang): Promise<SpeechStatus> {
  const { locale } = await speakChoice(lang);
  await fetchVoice(lang, Mode.speak, locale);
  return announce(await speakState(lang));
}

/** Reads every language the screens asked about again, refreshing what they are told next. */
export async function recheckVoices(): Promise<void> {
  const langs = new Set([...listenChoices.keys(), ...speakChoices.keys()]);
  await Promise.all([...langs].flatMap((lang) => [listenState(lang), speakState(lang)]));
  announce(undefined);
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

export function stopSpeaking(): Promise<void> {
  return quietly((e) => e.stopSpeaking());
}
