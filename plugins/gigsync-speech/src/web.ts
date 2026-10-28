import { WebPlugin } from "@capacitor/core";
import type { GigSyncSpeechPlugin, ListenResult, SpeechErrorCode, SpeechState, SpeechStatus } from "./definitions.js";

/**
 * Placeholder web engine: every language is unavailable, so the app offers typing and tap choices. The real engines
 * (Chrome's on-device recognizer, then the browser's own recognizer after consent, and local voices) replace it.
 */
/** Both a state and an error code. */
const UNAVAILABLE = "unavailable" satisfies SpeechState & SpeechErrorCode;
const NONE: SpeechStatus = { state: UNAVAILABLE, engine: "none" };

/** A rejection carrying the plugin's error code, the same shape the native plugins reject with. */
const refusal = (message: string) => Object.assign(new Error(message), { code: UNAVAILABLE });

export class GigSyncSpeechWeb extends WebPlugin implements GigSyncSpeechPlugin {
  async state(): Promise<SpeechStatus> {
    return NONE;
  }

  async prepare(): Promise<SpeechStatus> {
    return NONE;
  }

  async listen(): Promise<ListenResult> {
    throw refusal("no speech recognizer in this browser");
  }

  async stop(): Promise<void> {}

  async speak(): Promise<void> {
    throw refusal("no local voice in this browser");
  }

  async stopSpeaking(): Promise<void> {}
}
