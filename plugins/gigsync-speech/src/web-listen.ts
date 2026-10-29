import type {
  ListenOptions,
  ListenResult,
  SpeechErrorCode,
  SpeechState,
  SpeechStatus,
  SpeechVendor,
} from "./definitions.js";
import { within } from "./within.js";

/**
 * Speech to text in a browser (spec §3.1, ADR 0023). On the device first: Chrome 139+ runs its recognizer on this
 * computer when asked with `processLocally`, after a one-time language pack install from the owner's tap. Otherwise
 * the browser's ordinary recognizer, which sends the audio to its company (Google for Chrome, Apple for Safari), and
 * only when the app passes `allowCloud`, which it does only after the owner allowed that company. As in Collab web,
 * interim words fill the field and the handlers are detached before the recognizer is let go; unlike Collab, the
 * language is always the one the app asks for, never `navigator.language`.
 */

/** The parts of the Web Speech recognizer used here; lib.dom types its results but not the recognizer itself. */
interface Recognizer {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  phrases?: unknown[];
  onresult: ((e: { results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
interface LocalOptions {
  langs: string[];
  processLocally: true;
}
interface RecognizerClass {
  new (): Recognizer;
  prototype: object;
  available?: (options: LocalOptions) => Promise<string>;
  install?: (options: LocalOptions) => Promise<boolean>;
}
/** Chrome 142+: a word to expect, boosted by the on-device model. */
type PhraseClass = new (phrase: string, boost: number) => unknown;

const State = {
  available: "available",
  downloadable: "downloadable",
  downloading: "downloading",
  unavailable: "unavailable",
  denied: "denied",
} as const satisfies Record<SpeechState, SpeechState>;
const Code = {
  unavailable: "unavailable",
  downloadable: "downloadable",
  denied: "denied",
  busy: "busy",
} as const satisfies Record<SpeechErrorCode, SpeechErrorCode>;
const Vendor = { google: "google", apple: "apple", browser: "browser" } as const satisfies Record<
  SpeechVendor,
  SpeechVendor
>;
const Engine = { device: "chrome-ondevice", cloud: "browser-cloud", none: "none" } as const;
/** Chrome's language pack states that mean something here; anything else is "unavailable". */
const PACK: Readonly<Record<string, SpeechState>> = {
  available: State.available,
  downloadable: State.downloadable,
  downloading: State.downloading,
};
/** Web Speech error names this engine acts on. */
const Failure = {
  noSpeech: "no-speech",
  aborted: "aborted",
  notAllowed: "not-allowed",
  serviceNotAllowed: "service-not-allowed",
  language: "language-not-supported",
  phrases: "phrases-not-supported",
} as const;
const PROCESS_LOCALLY = "processLocally";
const PHRASES = "phrases";
const MICROPHONE = "microphone";
/** Chrome can leave `available()` unanswered; past this the language counts as unavailable. */
const STATE_MS = 3000;
/** A pack still downloading after this reports "downloading"; the owner can tap again later. */
const INSTALL_MS = 15000;
/** A recognizer that never ends on its own is stopped, and what it heard is kept. */
const LISTEN_MAX_MS = 60000;
const PHRASE_BOOST = 2;

/** Every iPhone and iPad browser runs Safari's engine, whose recognizer is Apple's. */
const IOS = /iPhone|iPad|iPod/;
/** Chromium browsers whose recognizer is not Google's (Edge's is Microsoft's): the app then names no company. */
const NOT_GOOGLE = /Edg(A|iOS)?\/|OPR\/|SamsungBrowser\/|YaBrowser\//;
const CHROME = /Chrome\//;
const SAFARI = /Safari\//;

/** Which company hears the audio when the browser's ordinary recognizer is used; when unsure, none is named. */
function vendorOf(nav: Navigator): SpeechVendor {
  const ua = nav.userAgent;
  if (IOS.test(ua)) return Vendor.apple;
  if (NOT_GOOGLE.test(ua) || "brave" in nav) return Vendor.browser;
  if (CHROME.test(ua)) return Vendor.google;
  return SAFARI.test(ua) ? Vendor.apple : Vendor.browser;
}

const recognizerClass = (): RecognizerClass | undefined => {
  const g = globalThis as { SpeechRecognition?: RecognizerClass; webkitSpeechRecognition?: RecognizerClass };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition;
};
/** The recognizer when this browser can run it on the device (Chrome 139+). */
const onDeviceClass = (): RecognizerClass | undefined => {
  const R = recognizerClass();
  return R?.available && PROCESS_LOCALLY in R.prototype ? R : undefined;
};
const local = (lang: string): LocalOptions => ({ langs: [lang], processLocally: true });
/** One listen's recognizer: interim words on, one phrase, on the device when `device` (with word hints there). */
function recognizer(lang: string, device: boolean, hints: readonly string[]): Recognizer | undefined {
  const R = recognizerClass();
  if (!R) return undefined;
  const rec = new R();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  if (device) rec.processLocally = true;
  const Phrase = (globalThis as { SpeechRecognitionPhrase?: PhraseClass }).SpeechRecognitionPhrase;
  if (Phrase && hints.length > 0 && PHRASES in rec) rec.phrases = hints.map((h) => new Phrase(h, PHRASE_BOOST));
  return rec;
}
/** A rejection carrying the plugin's error code, the same shape the native plugins reject with. */
const refusal = (code: SpeechErrorCode, message: string) => Object.assign(new Error(message), { code });
/** The on-device model can't take word hints for this language; listening is tried once more without them. */
class PhrasesRefused extends Error {}

export class WebListener {
  private active: Recognizer | undefined;
  private busy = false;
  private denied = false;
  /** Languages a recognizer refused while listening; they stay refused for this visit. */
  private readonly refusedOnDevice = new Set<string>();
  private readonly refusedInCloud = new Set<string>();

  async state(lang: string): Promise<SpeechStatus> {
    const state = await this.deviceState(lang);
    const engine = onDeviceClass() ? Engine.device : Engine.none;
    const cloud = state === State.available || state === State.denied ? undefined : this.cloud(lang);
    return cloud ? { state, engine, cloud } : { state, engine };
  }

  /** Installing is what starts Chrome's pack download; Chrome requires the owner's tap for it. */
  async prepare(lang: string): Promise<SpeechStatus> {
    const R = onDeviceClass();
    if (R?.install && (await this.deviceState(lang)) !== State.available) {
      try {
        await within(R.install(local(lang)), INSTALL_MS);
      } catch {
        // Still downloading, or refused: the state below says which.
      }
    }
    return this.state(lang);
  }

  async listen(options: ListenOptions, partial: (text: string) => void): Promise<ListenResult> {
    if (this.busy) throw refusal(Code.busy, "already listening");
    this.busy = true;
    try {
      const { lang, hints = [], allowCloud = false } = options;
      const state = await this.deviceState(lang);
      if (state === State.denied) throw refusal(Code.denied, "microphone not allowed");
      const device = state === State.available;
      if (!device && !(allowCloud && this.cloud(lang))) {
        throw state === State.unavailable
          ? refusal(Code.unavailable, "no recognizer for this language")
          : refusal(Code.downloadable, "the language pack is not on this computer yet");
      }
      try {
        return await this.hear(lang, device, device ? hints : [], partial);
      } catch (e) {
        if (e instanceof PhrasesRefused) return await this.hear(lang, device, [], partial);
        throw e;
      }
    } finally {
      this.busy = false;
    }
  }

  /** Ends listening; the words heard so far still come back from `listen`. */
  stop(): void {
    this.active?.stop();
  }

  private hear(
    lang: string,
    device: boolean,
    hints: readonly string[],
    partial: (text: string) => void,
  ): Promise<ListenResult> {
    const rec = recognizer(lang, device, hints);
    if (!rec) return Promise.reject(refusal(Code.unavailable, "no recognizer in this browser"));
    this.active = rec;
    return new Promise((done, fail) => {
      let final = "";
      let interim = "";
      let failure: string | undefined;
      const cap = setTimeout(() => rec.stop(), LISTEN_MAX_MS);
      rec.onresult = (e) => {
        final = "";
        interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const result = e.results[i];
          const words = result?.[0]?.transcript ?? "";
          if (result?.isFinal) final += words;
          else interim += words;
        }
        partial((final + interim).trim());
      };
      rec.onerror = (e) => {
        failure = e.error;
      };
      rec.onend = () => {
        clearTimeout(cap);
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        this.active = undefined;
        const problem = this.problem(failure, lang, device);
        if (problem) fail(problem);
        else done({ text: (final || interim).trim(), engine: device ? Engine.device : Engine.cloud, onDevice: device });
      };
      try {
        rec.start();
      } catch {
        clearTimeout(cap);
        this.active = undefined;
        fail(new Error("the recognizer would not start"));
      }
    });
  }

  /** What a recognizer's error means for the app; nothing for silence or a stop, so the words heard come back. */
  private problem(failure: string | undefined, lang: string, device: boolean): Error | undefined {
    switch (failure) {
      case undefined:
      case Failure.noSpeech:
      case Failure.aborted:
        return undefined;
      case Failure.notAllowed:
        this.denied = true;
        return refusal(Code.denied, "microphone not allowed");
      case Failure.serviceNotAllowed:
      case Failure.language:
        (device ? this.refusedOnDevice : this.refusedInCloud).add(lang);
        return refusal(Code.unavailable, "the recognizer refused this language");
      case Failure.phrases:
        return new PhrasesRefused();
      default:
        return new Error(`the recognizer failed: ${failure}`);
    }
  }

  private async deviceState(lang: string): Promise<SpeechState> {
    if (await this.micDenied()) return State.denied;
    const R = onDeviceClass();
    if (!R?.available || this.refusedOnDevice.has(lang)) return State.unavailable;
    try {
      return PACK[await within(R.available(local(lang)), STATE_MS)] ?? State.unavailable;
    } catch {
      return State.unavailable;
    }
  }

  private async micDenied(): Promise<boolean> {
    if (this.denied) return true;
    try {
      const mic = await within(navigator.permissions.query({ name: MICROPHONE }), STATE_MS);
      return mic.state === State.denied;
    } catch {
      return false;
    }
  }

  private cloud(lang: string): SpeechStatus["cloud"] {
    if (!recognizerClass() || this.refusedInCloud.has(lang)) return undefined;
    return { engine: Engine.cloud, vendor: vendorOf(navigator) };
  }
}
