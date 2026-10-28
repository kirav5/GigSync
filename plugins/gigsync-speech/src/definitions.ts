import type { PluginListenerHandle } from "@capacitor/core";

/** What the engine can do for one language on this device. "denied": the owner refused the microphone. */
export type SpeechState = "available" | "downloadable" | "downloading" | "unavailable" | "denied";
export type SpeechMode = "listen" | "speak";
/** Why listen() rejected; carried as the rejection's `code`. */
export type SpeechErrorCode = "unavailable" | "downloadable" | "denied" | "busy";
/** Who runs a cloud recognizer: "google" (Android's default service, Chrome), "apple" (iPhone, Safari), "browser" (unknown vendor). */
export type SpeechVendor = "google" | "apple" | "browser";

export interface SpeechLangOptions {
  /** BCP 47 locale, e.g. "hi-IN". */
  lang: string;
  mode: SpeechMode;
}

export interface SpeechStatus {
  /** The on-device engine's state for this language (unchanged meaning). */
  state: SpeechState;
  /** Which engine answered: "android-ondevice", "apple-ondevice", "chrome-ondevice", "android-cloud", "apple-cloud", "browser-cloud", or "none". */
  engine: string;
  /** Present only for mode "listen" when the on-device state is not "available" but a cloud recognizer exists for the language. */
  cloud?: { engine: string; vendor: SpeechVendor };
}

export interface ListenOptions {
  lang: string;
  /** Words to expect for this question (trade names, areas, number words): biasing strings / contextualStrings / phrases. */
  hints?: string[];
  /** Use the cloud recognizer when on-device is not available. Default false; the app passes true only after consent. */
  allowCloud?: boolean;
}

export interface ListenResult {
  /** The final words; "" when nothing was heard. */
  text: string;
  engine: string;
  /** False when the audio went to a cloud recognizer. */
  onDevice: boolean;
}

export interface PartialEvent {
  text: string;
}

export interface SpeakOptions {
  lang: string;
  text: string;
}

export interface GigSyncSpeechPlugin {
  state(options: SpeechLangOptions): Promise<SpeechStatus>;
  /** Fetches the language's on-device model or voice data once. Call only from an owner's tap. */
  prepare(options: SpeechLangOptions): Promise<SpeechStatus>;
  /**
   * Asks for the microphone (and, on iPhone, speech recognition) on first use; resolves at end of speech or stop().
   * Rejects with code "unavailable" when on-device is unavailable and `allowCloud` is false or no cloud recognizer
   * exists. Never uses the cloud without `allowCloud: true`.
   */
  listen(options: ListenOptions): Promise<ListenResult>;
  stop(): Promise<void>;
  /** Resolves when finished; rejects when no on-device voice exists for the language. */
  speak(options: SpeakOptions): Promise<void>;
  stopSpeaking(): Promise<void>;
  addListener(event: "partial", listener: (e: PartialEvent) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}
