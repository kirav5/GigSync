import type { SpeechMode, SpeechStatus } from "@gigsync/plugin-speech";
import { ListenRefusal, type SpeechEngine, VoiceState } from "./speech.js";

/**
 * DEV ONLY: a scripted speech engine for the UI tests (spec §3.3, amendment A1). It is active when
 * localStorage["gigsync-fake-speech"] holds a JSON array of strings, and each listen takes the next one.
 * localStorage["gigsync-fake-speech-mode"] picks what the phone can do: absent, listening works on the device;
 * "cloud", only a cloud recognizer exists, so the consent sheet shows; "none", nothing listens at all.
 * Reading aloud always has a voice and finishes at once. speech.ts loads this module only under import.meta.env.DEV,
 * so release builds never contain it.
 */
const QUEUE_KEY = "gigsync-fake-speech";
const MODE_KEY = "gigsync-fake-speech-mode";
const FakeMode = { cloud: "cloud", none: "none" } as const;
const LISTEN = "listen" satisfies SpeechMode;
const ENGINE = "fake";
const CLOUD: NonNullable<SpeechStatus["cloud"]> = { engine: "fake-cloud", vendor: "google" };

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

function listening(mode: string | null): SpeechStatus {
  if (mode === FakeMode.cloud) return { state: VoiceState.unavailable, engine: ENGINE, cloud: CLOUD };
  if (mode === FakeMode.none) return { state: VoiceState.unavailable, engine: ENGINE };
  return { state: VoiceState.available, engine: ENGINE };
}

/** The fake engine, or undefined when no test asked for one. */
export function fakeSpeech(): SpeechEngine | undefined {
  const queue = answers();
  if (!queue) return undefined;
  const status = listening(stored(MODE_KEY));
  const speaking: SpeechStatus = { state: VoiceState.available, engine: ENGINE };
  const state = async ({ mode }: { mode: SpeechMode }) => (mode === LISTEN ? status : speaking);
  return {
    state,
    prepare: state,
    async listen({ allowCloud = false }, onPartial) {
      const onDevice = status.state === VoiceState.available;
      if (!onDevice && !(allowCloud && status.cloud)) {
        throw Object.assign(new Error("fake: no recognizer"), { code: ListenRefusal.unavailable });
      }
      const text = queue.shift() ?? "";
      if (text) onPartial(text);
      return { text, engine: onDevice ? ENGINE : CLOUD.engine, onDevice };
    },
    stop: async () => {},
    speak: async () => {},
    stopSpeaking: async () => {},
  };
}
