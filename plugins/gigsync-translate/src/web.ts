import { WebPlugin } from "@capacitor/core";
import type {
  GigSyncTranslatePlugin,
  PairOptions,
  PairState,
  PairStatus,
  TranslateOptions,
  TranslateResult,
} from "./definitions.js";

/**
 * The web engine: Chrome's built-in Translator API, which runs language packs on this computer and sends nothing to a
 * server. Chrome offers it from version 138 on desktop; a pack downloads once per pair, and only after a user's tap.
 * Other browsers have no such API, so there this reports "none" and the app shows the original text alone.
 */
interface ChromeTranslator {
  translate(text: string): Promise<string>;
}
interface ChromeTranslatorFactory {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<PairState>;
  create(options: { sourceLanguage: string; targetLanguage: string }): Promise<ChromeTranslator>;
}

const ENGINE = "chrome-built-in";
const NONE = "none";
const AVAILABLE: PairState = "available";
const UNAVAILABLE: PairState = "unavailable";
const SEPARATOR = ">";
/**
 * Chrome can leave `availability()` unanswered (seen in headless Chrome 156 with no language packs), and a model can
 * stall: past these limits the app treats the pair as unavailable and shows the original text alone.
 */
const STATE_MS = 3000;
const TRANSLATE_MS = 15000;

class TimedOut extends Error {}

/** `work`, or a `TimedOut` rejection once `ms` have passed. */
function within<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, fail) => {
    timer = setTimeout(() => fail(new TimedOut()), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

const factory = () => (globalThis as { Translator?: ChromeTranslatorFactory }).Translator;
const pair = ({ from, to }: PairOptions) => ({ sourceLanguage: from, targetLanguage: to });

export class GigSyncTranslateWeb extends WebPlugin implements GigSyncTranslatePlugin {
  private readonly sessions = new Map<string, Promise<ChromeTranslator>>();

  async state(options: PairOptions): Promise<PairStatus> {
    const tr = factory();
    if (!tr) return { state: UNAVAILABLE, engine: NONE };
    try {
      return { state: await within(tr.availability(pair(options)), STATE_MS), engine: ENGINE };
    } catch {
      return { state: UNAVAILABLE, engine: ENGINE };
    }
  }

  /** Creating a translator is what starts Chrome's download; Chrome requires a user's tap for it. */
  async prepare(options: PairOptions): Promise<PairStatus> {
    if (!factory()) return { state: UNAVAILABLE, engine: NONE };
    try {
      await this.session(options);
    } catch {
      this.sessions.delete(options.from + SEPARATOR + options.to);
    }
    return this.state(options);
  }

  async translate(options: TranslateOptions): Promise<TranslateResult> {
    const status = await this.state(options);
    if (status.state !== AVAILABLE) return { available: false, text: "", engine: status.engine };
    try {
      const text = await within(
        this.session(options).then((s) => s.translate(options.text)),
        TRANSLATE_MS,
      );
      return { available: true, text, engine: ENGINE };
    } catch {
      this.sessions.delete(options.from + SEPARATOR + options.to);
      return { available: false, text: "", engine: ENGINE };
    }
  }

  private session(options: PairOptions): Promise<ChromeTranslator> {
    const key = options.from + SEPARATOR + options.to;
    let s = this.sessions.get(key);
    if (!s) {
      s = (factory() as ChromeTranslatorFactory).create(pair(options));
      this.sessions.set(key, s);
    }
    return s;
  }
}
