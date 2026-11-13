import { Collection, type Embedder, log, mayResumeAlone, type Reader, type Storage } from "@gigsync/core";
import type { ReaderInput, ReaderResult } from "@gigsync/protocol";
import {
  EMBEDDING_MODEL,
  FromWorker,
  type FromWorkerMessage,
  ToWorker,
  type ToWorkerMessage,
} from "./embed/messages.js";
import { currentNetwork } from "./model-device.js";

/**
 * The understanding pack (ADR 0042): a small multilingual embedding model that runs inside this app, through ONNX
 * Runtime in the browser or webview, and turns a sentence into a vector core compares with its labelled sayings. It is
 * fetched once, by itself on Wi-Fi, and kept by the browser's cache; after that it loads from the device and nothing
 * typed ever leaves the phone, so it stays on whichever model answers, or none. The model itself runs in a worker
 * (embed/worker.ts), so loading and embedding never hold up typing or the screen.
 */

export { EMBEDDING_MODEL };

/**
 * The phone's reader (ADR 0065), fetched with the pack from GigSync's model host: the folder its files are in, set at
 * build time (`VITE_READER_URL`). A build without it has no reader, and Find reads as before.
 */
const READER_URL = import.meta.env.VITE_READER_URL?.replace(/\/+$/, "") || undefined;
/** Remembers that the pack was fetched, so later launches load it from the cache without asking again. */
const SETTINGS_KEY = "understanding_pack";
/** Where Transformers.js keeps fetched files (its browser Cache name), and the files this model needs. */
const TRANSFORMERS_CACHE = "transformers-cache";
const MODEL_FILES = ["config.json", "tokenizer_config.json", "tokenizer.json", "onnx/model_quantized.onnx"];
const REVISION = "main";
/** Transformers.js's default model host, as its cache keys start (`env.remoteHost`); read here without loading it. */
const MODEL_HOST = "https://huggingface.co/";

const PackState = {
  /** Not fetched yet. */
  downloadable: "downloadable",
  downloading: "downloading",
  ready: "ready",
  /** The fetch or the runtime failed; the next launch on Wi-Fi tries again. */
  failed: "failed",
} as const;
type PackState = (typeof PackState)[keyof typeof PackState];

type Vectors = (readonly number[] | null)[];

/** The embedding model's and the reader's state on this device, and the `Embedder` and `Reader` core is handed. */
export class UnderstandingPack implements Embedder, Reader {
  state: PackState = PackState.downloadable;
  /** The reader's own state once the embedding model is ready; undefined in a build with no reader. */
  readerState: PackState | undefined = READER_URL ? PackState.downloadable : undefined;
  private settleReader: (() => void) | undefined;
  private readonly readings = new Map<number, (result: ReaderResult | null) => void>();
  private worker: Worker | undefined;
  private loading: Promise<void> | undefined;
  private settle: ((ok: boolean) => void) | undefined;
  private nextId = 0;
  private readonly pending = new Map<number, (vectors: Vectors | null) => void>();
  /** The device's settings, from `load`: the pack belongs to the device (its cache), not to one owner. */
  private storage: Storage | undefined;

  /**
   * Loads the pack when it was fetched on this device before and the browser still holds every file of it. Otherwise
   * it fetches the pack by itself on Wi-Fi, never on mobile data or where the browser can't tell (Settings has no
   * button for it: the pack is meant to come with the app, and until it does, Wi-Fi brings it).
   */
  async load(storage: Storage): Promise<void> {
    this.storage = storage;
    const fetched = await storage.get<boolean>(Collection.settings, SETTINGS_KEY);
    const wifi = mayResumeAlone(currentNetwork());
    if (fetched && (await this.cached())) await this.start();
    else if (wifi) return this.prepare();
    // A reader newer than the pack on this phone comes the same way.
    await this.startReader(wifi);
  }

  /** Fetches the pack, once, then keeps it: the embedding model, then the reader. */
  private async prepare(): Promise<void> {
    await this.start();
    if (this.state === PackState.ready) await this.storage?.put(Collection.settings, SETTINGS_KEY, true);
    await this.startReader(true);
  }

  /** The reader, once the embedding model is ready: from the device at launch, from the host only with the pack. */
  private startReader(fetchIt: boolean): Promise<void> {
    if (!READER_URL || this.state !== PackState.ready || this.readerState === PackState.ready) return Promise.resolve();
    if (fetchIt) this.setReader(PackState.downloading);
    return new Promise((resolve) => {
      this.settleReader = resolve;
      this.send({ type: ToWorker.loadReader, url: READER_URL, fetch: fetchIt });
    });
  }

  /** True when the browser's cache holds every file the model loads, so loading reaches no network. */
  private async cached(): Promise<boolean> {
    try {
      if (!(await caches.has(TRANSFORMERS_CACHE))) return false;
      const cache = await caches.open(TRANSFORMERS_CACHE);
      const base = `${MODEL_HOST}${EMBEDDING_MODEL}/resolve/${REVISION}/`;
      const found = await Promise.all(MODEL_FILES.map((file) => cache.match(`${base}${file}`)));
      return found.every((hit) => hit !== undefined);
    } catch {
      return false;
    }
  }

  private send(m: ToWorkerMessage) {
    if (!this.worker) {
      this.worker = new Worker(new URL("./embed/worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e: MessageEvent<FromWorkerMessage>) => this.heard(e.data);
    }
    this.worker.postMessage(m);
  }

  private heard(m: FromWorkerMessage) {
    switch (m.type) {
      case FromWorker.progress:
        return this.set(PackState.downloading);
      case FromWorker.ready:
        this.set(PackState.ready);
        return this.settle?.(true);
      case FromWorker.failed:
        log.warn("understanding pack: load failed", { error: m.error });
        this.set(PackState.failed);
        return this.settle?.(false);
      case FromWorker.vectors:
        this.pending.get(m.id)?.(m.vectors);
        return this.pending.delete(m.id);
      case FromWorker.error:
        log.warn("understanding pack: embed or read failed", { error: m.error });
        this.pending.get(m.id)?.(null);
        this.readings.get(m.id)?.(null);
        this.readings.delete(m.id);
        return this.pending.delete(m.id);
      default:
        return this.heardReader(m);
    }
  }

  private heardReader(m: FromWorkerMessage) {
    switch (m.type) {
      case FromWorker.readerProgress:
        return this.setReader(PackState.downloading);
      case FromWorker.readerReady:
        this.setReader(PackState.ready);
        return this.settleReader?.();
      case FromWorker.readerFailed:
        // Not on the device yet is no failure: the reader comes with the pack, on Wi-Fi.
        if (this.readerState === PackState.downloading) log.warn("reader: load failed", { error: m.error });
        this.setReader(this.readerState === PackState.downloading ? PackState.failed : PackState.downloadable);
        return this.settleReader?.();
      case FromWorker.reading:
        this.readings.get(m.id)?.(m.result);
        return this.readings.delete(m.id);
    }
  }

  private start(): Promise<void> {
    if (this.state === PackState.ready) return Promise.resolve();
    this.loading ??= new Promise<void>((resolve) => {
      this.set(PackState.downloading);
      this.settle = (ok) => {
        this.loading = ok ? this.loading : undefined;
        resolve();
      };
      this.send({ type: ToWorker.load });
    });
    return this.loading;
  }

  private ask(texts: readonly string[], keep: boolean): Promise<Vectors | null> {
    if (this.state !== PackState.ready) return Promise.resolve(null);
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.send({ type: ToWorker.embed, id, texts, keep });
    });
  }

  /** An owner's own words: embedded in the worker and forgotten there. */
  async embed(text: string): Promise<readonly number[] | null> {
    return (await this.ask([text], false))?.[0] ?? null;
  }

  /** Fixed sayings, a batch at a time: the worker keeps their vectors, so later launches start ready. */
  async embedMany(texts: readonly string[]): Promise<Vectors> {
    return (await this.ask(texts, true)) ?? texts.map(() => null);
  }

  /**
   * One message read on the phone; null with no reader ready. Which messages it is asked to read is Find's choice
   * (`readMessage` in core).
   */
  read(input: ReaderInput): Promise<ReaderResult | null> {
    if (this.readerState !== PackState.ready) return Promise.resolve(null);
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.readings.set(id, resolve);
      this.send({ type: ToWorker.read, id, input });
    });
  }

  private setReader(state: PackState) {
    this.readerState = state;
  }

  private set(state: PackState) {
    this.state = state;
  }
}

/** The app's one pack. */
export const understanding = new UnderstandingPack();
