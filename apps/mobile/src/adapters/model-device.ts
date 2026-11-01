import {
  Collection,
  type ConnectionFacts,
  DEFAULT_MAX_TOKENS,
  freshSpeed,
  type GenerateOptions,
  log,
  mayResumeAlone,
  type Network,
  networkOf,
  recordSpeed,
  type SpeedRecord,
  type Storage,
  tooSlow,
} from "@gigsync/core";
import { type ModelOptions, ModelState, type ModelStatus } from "@gigsync/plugin-llm";
import { type ModelEngine, modelEngine, NO_MODEL } from "./model-engine.js";

/**
 * The phone's own model as the app manages it (LLD §9.1): what the engine reports, the owner's answer to the offer,
 * a download they agreed to (resumed by itself only on Wi-Fi), the one line saying it is ready, and the speed guard.
 * Kept per phone, in the settings everyone signed in on it shares, as the model itself is.
 */

/** The owner's answer to the chat's one offer to download the model. */
const OfferAnswer = { download: "download", later: "later" } as const;
type OfferAnswer = (typeof OfferAnswer)[keyof typeof OfferAnswer];

interface DeviceModelRecord {
  offer?: OfferAnswer;
  /** A download the owner agreed to that has not finished yet. */
  wanted?: boolean;
  /** The chat said once that the model is ready. */
  readySaid?: boolean;
  speed: SpeedRecord;
}

/** What the chat shows about the model, if anything (screens/model/ModelNotice.tsx). */
export const Notice = { offer: "offer", downloading: "downloading", paused: "paused", ready: "ready" } as const;
export type Notice = (typeof Notice)[keyof typeof Notice];

const RECORD_KEY = "model_device";
/** Below this much free memory (where the OS says), Auto stays in lite mode instead of loading a model (LLD §8.4). */
const MIN_FREE_MB = 1500;

/** The browser's word on the connection; Safari gives none. */
export const currentNetwork = (): Network => networkOf((navigator as { connection?: ConnectionFacts }).connection);

/** The model is ready, and the phone has the memory for it (the native engines report free memory; the web none). */
const deviceUsable = (s: ModelStatus | undefined) =>
  Boolean(s?.available) && (s?.freeMemoryMb === undefined || s.freeMemoryMb >= MIN_FREE_MB);

async function quietly<T>(work: (e: ModelEngine) => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work(await modelEngine());
  } catch (err) {
    log.debug("model: engine call failed", { error: err instanceof Error ? err.name : String(err) });
    return fallback;
  }
}

export class OnDevice {
  status: ModelStatus | undefined;
  record: DeviceModelRecord = { speed: freshSpeed() };
  private storage: Storage | undefined;
  private options: ModelOptions;

  constructor(
    private readonly changed: () => void,
    baseUrl: string | undefined,
  ) {
    this.options = baseUrl ? { baseUrl } : {};
  }

  get downloading(): boolean {
    return this.status?.state === ModelState.downloading;
  }

  async load(storage: Storage): Promise<void> {
    this.storage = storage;
    const saved = await storage.get<DeviceModelRecord>(Collection.settings, RECORD_KEY);
    if (saved) this.record = { ...saved, speed: saved.speed ?? freshSpeed() };
    await this.refresh();
    // A download the owner agreed to that stopped part-way carries on by itself only on Wi-Fi.
    if (this.notice() === Notice.paused && mayResumeAlone(currentNetwork())) void this.download();
  }

  async refresh(): Promise<void> {
    if (this.downloading) return;
    this.status = await quietly((e) => e.status(this.options), NO_MODEL);
    this.changed();
  }

  /** Downloads the model the owner agreed to, with progress; call only from their tap, or a resume on Wi-Fi. */
  async download(): Promise<void> {
    if (this.downloading) return;
    await this.save({ offer: OfferAnswer.download, wanted: true });
    const final = await quietly(
      (e) =>
        e.prepare(this.options, (s) => {
          this.status = s;
          this.changed();
        }),
      NO_MODEL,
    );
    this.status = final.state === undefined ? await quietly((e) => e.status(this.options), NO_MODEL) : final;
    if (this.status.available) await this.save({ wanted: false });
    this.changed();
  }

  later = () => this.save({ offer: OfferAnswer.later });
  sayReady = () => this.save({ readySaid: true });
  /** "Try again" after the speed guard gave up on this phone: the next answers are timed afresh. */
  retrySpeed = () => this.save({ speed: freshSpeed() });

  async remove(): Promise<void> {
    this.status = await quietly((e) => e.remove(this.options), NO_MODEL);
    await this.save({ wanted: false, readySaid: false });
  }

  get tooSlow(): boolean {
    return tooSlow(this.record.speed);
  }

  /** Auto uses the model: ready, room in memory, and not found too slow on this phone. */
  usable(): boolean {
    return deviceUsable(this.status) && !this.tooSlow;
  }

  /** The model's answer, or null. Routing answers (asked as JSON) are timed for the speed guard. */
  async generate(prompt: string, options?: GenerateOptions): Promise<string | null> {
    const result = await quietly(
      (e) =>
        e.generate({
          ...this.options,
          prompt,
          maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
          ...(options?.temperature === undefined ? {} : { temperature: options.temperature }),
          ...(options?.json ? { json: true } : {}),
          ...(options?.schema ? { schema: options.schema } : {}),
        }),
      { available: false, text: "", engine: NO_MODEL.engine },
    );
    if (result.available && options?.json && result.elapsedMs !== undefined) {
      log.debug("model: routing answer timed", { ms: result.elapsedMs });
      await this.save({ speed: recordSpeed(this.record.speed, result.elapsedMs) });
    }
    return result.available ? result.text : null;
  }

  /** What the chat should show now. */
  notice(): Notice | undefined {
    const { status, record } = this;
    if (this.downloading) return Notice.downloading;
    if (status?.available) return record.offer === OfferAnswer.download && !record.readySaid ? Notice.ready : undefined;
    if (status?.state !== ModelState.downloadable) return undefined;
    if (record.wanted) return Notice.paused;
    return record.offer ? undefined : Notice.offer;
  }

  private async save(change: Partial<DeviceModelRecord>): Promise<void> {
    this.record = { ...this.record, ...change };
    this.changed();
    await this.storage?.put(Collection.settings, RECORD_KEY, this.record);
  }
}
