import { WebPlugin } from "@capacitor/core";
import type {
  GigSyncSpeechPlugin,
  ListenOptions,
  ListenResult,
  PartialEvent,
  SpeakOptions,
  SpeechLangOptions,
  SpeechMode,
  SpeechStatus,
} from "./definitions.js";
import { WebListener } from "./web-listen.js";
import { WebSpeaker } from "./web-speak.js";

/**
 * The browser engines: speech to text in `web-listen.ts` (Chrome's on-device recognizer, or the browser's own after
 * the owner allowed its company) and reading aloud in `web-speak.ts` (local voices only). The Android WebView never
 * gets here: the native plugin answers there.
 */
const LISTEN = "listen" satisfies SpeechMode;
const PARTIAL = "partial";

export class GigSyncSpeechWeb extends WebPlugin implements GigSyncSpeechPlugin {
  private readonly ears = new WebListener();
  private readonly voice = new WebSpeaker();

  async state({ lang, mode }: SpeechLangOptions): Promise<SpeechStatus> {
    return mode === LISTEN ? this.ears.state(lang) : this.voice.state(lang);
  }

  /** Local voices need no download in a browser, so for speaking this only reports the state. */
  async prepare({ lang, mode }: SpeechLangOptions): Promise<SpeechStatus> {
    return mode === LISTEN ? this.ears.prepare(lang) : this.voice.state(lang);
  }

  async listen(options: ListenOptions): Promise<ListenResult> {
    return this.ears.listen(options, (text) => this.notifyListeners(PARTIAL, { text } satisfies PartialEvent));
  }

  async stop(): Promise<void> {
    this.ears.stop();
  }

  async speak(options: SpeakOptions): Promise<void> {
    return this.voice.speak(options);
  }

  async stopSpeaking(): Promise<void> {
    this.voice.stop();
  }
}
