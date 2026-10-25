import { WebPlugin } from "@capacitor/core";
import {
  type GenerateOptions,
  type GenerateResult,
  type GigSyncLLMPlugin,
  ModelDownload,
  type ModelStatus,
} from "./definitions.js";

/**
 * The web engine: Chrome's built-in model (Gemini Nano through the Prompt API, `LanguageModel`). Chrome offers it to
 * web pages from version 138 on desktop only: Windows 10/11, macOS 13+, Linux and Chromebook Plus, with about 22 GB
 * free and a 4 GB GPU or 16 GB RAM. Chrome on Android and every iPhone browser have no such model, so there, and in
 * any other browser, this reports "none" and the app runs in lite mode. Languages today: English, Japanese, Spanish,
 * German, French; we ask for English.
 */
interface ChromeSession {
  prompt(input: string): Promise<string>;
}
type Availability = "unavailable" | "downloadable" | "downloading" | "available";
interface ChromeLanguageModel {
  availability(options: object): Promise<Availability>;
  create(options: object): Promise<ChromeSession>;
}

const ENGINE = "chrome-built-in";
const NONE = "none";
const AVAILABLE: Availability = "available";
const OPTIONS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};
const NOTHING: ModelStatus = { available: false, engine: NONE };
const DOWNLOAD_STATES: ReadonlySet<string> = new Set(Object.values(ModelDownload));

const chrome = () => (globalThis as { LanguageModel?: ChromeLanguageModel }).LanguageModel;

export class GigSyncLLMWeb extends WebPlugin implements GigSyncLLMPlugin {
  private session: Promise<ChromeSession> | undefined;

  async status(): Promise<ModelStatus> {
    const lm = chrome();
    if (!lm) return NOTHING;
    try {
      const state = await lm.availability(OPTIONS);
      const download = DOWNLOAD_STATES.has(state) ? { download: state as ModelDownload } : {};
      return { available: state === AVAILABLE, engine: ENGINE, ...download };
    } catch {
      return NOTHING;
    }
  }

  /** Starts Chrome's one-time model download. Chrome requires a user's tap for this, so Settings calls it from a button. */
  async prepare(): Promise<ModelStatus> {
    const lm = chrome();
    if (!lm) return NOTHING;
    this.session ??= lm.create(OPTIONS);
    this.session.catch(() => {
      this.session = undefined;
    });
    return this.status();
  }

  async generate({ prompt }: GenerateOptions): Promise<GenerateResult> {
    const lm = chrome();
    const status = await this.status();
    if (!lm || !status.available) return { available: false, text: "", engine: status.engine };
    try {
      this.session ??= lm.create(OPTIONS);
      const text = await (await this.session).prompt(prompt);
      return { available: true, text, engine: ENGINE };
    } catch {
      this.session = undefined;
      return { available: false, text: "", engine: ENGINE };
    }
  }
}
