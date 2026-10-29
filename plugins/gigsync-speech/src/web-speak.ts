import type { SpeakOptions, SpeechErrorCode, SpeechState, SpeechStatus } from "./definitions.js";
import { within } from "./within.js";

/**
 * Reading aloud in a browser with `speechSynthesis`, using only voices that run on this device (`localService`):
 * questions are fixed text, but an agent's reply can be private, so no voice that needs a server is ever picked.
 * Phone browsers often have none for Hindi or Kannada; the app then shows no speaker button.
 */

const AVAILABLE = "available" satisfies SpeechState;
/** Both a state and an error code. */
const UNAVAILABLE = "unavailable" satisfies SpeechState & SpeechErrorCode;
const ENGINE = "browser-ondevice";
const NONE = "none";
const VOICES_CHANGED = "voiceschanged";
/** Chrome fills its voice list a moment after load; past this the list is taken as it is. */
const VOICES_MS = 2000;
/** Speech that ends because the app stopped it, or spoke over it, is not a failure. */
const STOPPED: ReadonlySet<string> = new Set(["interrupted", "canceled"]);
const TAG_SEPARATOR = /[-_]/;

const synth = (): SpeechSynthesis | undefined => globalThis.speechSynthesis;
/** "hi-IN", "hi_IN" and "HI-in" are the same voice language; browsers disagree on the spelling. */
const tag = (lang: string) => lang.split(TAG_SEPARATOR).join("-").toLowerCase();
const primary = (lang: string) => tag(lang).split("-")[0];

async function voices(s: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  if (s.getVoices().length === 0) {
    try {
      await within(new Promise((ready) => s.addEventListener(VOICES_CHANGED, ready, { once: true })), VOICES_MS);
    } catch {
      // No voices at all in this browser: the list stays empty.
    }
  }
  return s.getVoices();
}

/** A local voice for the locale: the same region first ("hi-IN"), then the same language ("hi"). */
async function localVoice(lang: string): Promise<SpeechSynthesisVoice | undefined> {
  const s = synth();
  if (!s) return undefined;
  const mine = (await voices(s)).filter((v) => v.localService);
  return mine.find((v) => tag(v.lang) === tag(lang)) ?? mine.find((v) => primary(v.lang) === primary(lang));
}

const refusal = (message: string) => Object.assign(new Error(message), { code: UNAVAILABLE });

export class WebSpeaker {
  async state(lang: string): Promise<SpeechStatus> {
    if (!synth()) return { state: UNAVAILABLE, engine: NONE };
    return { state: (await localVoice(lang)) ? AVAILABLE : UNAVAILABLE, engine: ENGINE };
  }

  /** Resolves when the words have been spoken, or when the app stops or replaces them. */
  async speak({ lang, text }: SpeakOptions): Promise<void> {
    const s = synth();
    const voice = await localVoice(lang);
    if (!s || !voice) throw refusal("no local voice for this language");
    s.cancel();
    await new Promise<void>((done, fail) => {
      const words = new SpeechSynthesisUtterance(text);
      words.voice = voice;
      words.lang = voice.lang;
      words.onend = () => done();
      // "not-allowed" (no tap yet on this page) is passed on; the app's readAloud swallows it.
      words.onerror = (e) =>
        STOPPED.has(e.error) ? done() : fail(Object.assign(new Error(e.error), { code: e.error }));
      s.speak(words);
    });
  }

  stop(): void {
    synth()?.cancel();
  }
}
