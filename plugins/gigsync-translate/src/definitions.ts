/** What the engine can do for one language pair on this device. */
export type PairState = "available" | "downloadable" | "downloading" | "unavailable";

export interface PairOptions {
  /** BCP 47 primary subtags, e.g. "kn" and "hi". */
  from: string;
  to: string;
}

export interface PairStatus {
  state: PairState;
  /** Which engine answered: "chrome-built-in", "mlkit", or "none". */
  engine: string;
}

export interface TranslateOptions extends PairOptions {
  text: string;
}

export interface TranslateResult {
  /** False when the pair is not ready or the engine failed; `text` is then empty and the original is shown alone. */
  available: boolean;
  text: string;
  engine: string;
}

export interface GigSyncTranslatePlugin {
  state(options: PairOptions): Promise<PairStatus>;
  /** Fetches the pair's language pack once. Call only from an owner's tap. */
  prepare(options: PairOptions): Promise<PairStatus>;
  translate(options: TranslateOptions): Promise<TranslateResult>;
}
