import { Collection, type Embedder, log, type Storage } from "@gigsync/core";
import { useSyncExternalStore } from "react";
import {
  EMBEDDING_MODEL,
  FromWorker,
  type FromWorkerMessage,
  ToWorker,
  type ToWorkerMessage,
} from "./embed/messages.js";
import { chosenModel, ModelChoice } from "./model.js";

/**
 * The understanding pack (ADR 0042): a small multilingual embedding model that runs inside this app, through ONNX
 * Runtime in the browser or webview, and turns a sentence into a vector core compares with its labelled sayings. It is
 * fetched once, on the owner's tap, and kept by the browser's cache; after that it loads from the device and nothing
 * typed ever leaves the phone. Lite mode turns it off like every other model. The model itself runs in a worker
 * (embed/worker.ts), so loading and embedding never hold up typing or the screen.
 */

export { EMBEDDING_MODEL };
export const EMBEDDING_PACK_MB = 129;
const PERCENT = 100;
/** Remembers that the owner fetched the pack, so later launches load it from the cache without asking again. */
const SETTINGS_KEY = "understanding_pack";
/** Where Transformers.js keeps fetched files (its browser Cache name), and the files this model needs. */
const TRANSFORMERS_CACHE = "transformers-cache";
const MODEL_FILES = ["config.json", "tokenizer_config.json", "tokenizer.json", "onnx/model_quantized.onnx"];
const REVISION = "main";
/** Transformers.js's default model host, as its cache keys start (`env.remoteHost`); read here without loading it. */
const MODEL_HOST = "https://huggingface.co/";

export const PackState = {
  /** Not fetched; a tap fetches it. */
  downloadable: "downloadable",
  downloading: "downloading",
  ready: "ready",
  /** The fetch or the runtime failed; a tap tries again. */
  failed: "failed",
} as const;
export type PackState = (typeof PackState)[keyof typeof PackState];

type Vectors = (readonly number[] | null)[];

/** The embedding model's state on this device, and the `Embedder` the agent's ports hand to core. */
export class UnderstandingPack implements Embedder {
  state: PackState = PackState.downloadable;
  /** Of the download, 0 to 100, while downloading. */
  percent = 0;
  private worker: Worker | undefined;
  private loading: Promise<void> | undefined;
  private settle: ((ok: boolean) => void) | undefined;
  private nextId = 0;
  private readonly pending = new Map<number, (vectors: Vectors | null) => void>();
  /** The device's settings, from `load`: the pack belongs to the device (its cache), not to one owner. */
  private storage: Storage | undefined;
  private readonly listeners = new Set<() => void>();
  private version = 0;

  /**
   * Loads the pack when it was fetched on this device before and the browser still holds every file of it; never
   * fetches on its own. A cache the browser has since cleared leaves the pack downloadable, for the owner's tap.
   */
  async load(storage: Storage): Promise<void> {
    this.storage = storage;
    const fetched = await storage.get<boolean>(Collection.settings, SETTINGS_KEY);
    if (fetched && (await this.cached())) await this.start();
  }

  /** Fetches the pack, once, then keeps it. Call only from the owner's tap. */
  async prepare(): Promise<void> {
    await this.start();
    if (this.state === PackState.ready) await this.storage?.put(Collection.settings, SETTINGS_KEY, true);
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
        return this.set(PackState.downloading, m.percent);
      case FromWorker.ready:
        this.set(PackState.ready, PERCENT);
        return this.settle?.(true);
      case FromWorker.failed:
        log.warn("understanding pack: load failed", { error: m.error });
        this.set(PackState.failed, 0);
        return this.settle?.(false);
      case FromWorker.vectors:
        this.pending.get(m.id)?.(m.vectors);
        return this.pending.delete(m.id);
      case FromWorker.error:
        log.warn("understanding pack: embed failed", { error: m.error });
        this.pending.get(m.id)?.(null);
        return this.pending.delete(m.id);
    }
  }

  private start(): Promise<void> {
    if (this.state === PackState.ready) return Promise.resolve();
    this.loading ??= new Promise<void>((resolve) => {
      this.set(PackState.downloading, 0);
      this.settle = (ok) => {
        this.loading = ok ? this.loading : undefined;
        resolve();
      };
      this.send({ type: ToWorker.load });
    });
    return this.loading;
  }

  private ask(texts: readonly string[], keep: boolean): Promise<Vectors | null> {
    if (this.state !== PackState.ready || chosenModel.current.choice === ModelChoice.lite) return Promise.resolve(null);
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

  private set(state: PackState, percent: number) {
    this.state = state;
    this.percent = percent;
    this.version += 1;
    for (const fn of this.listeners) fn();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  snapshot = () => this.version;
}

/** The app's one pack. */
export const understanding = new UnderstandingPack();

/** Re-renders a component whenever the pack's state changes. */
export function useUnderstanding(): UnderstandingPack {
  useSyncExternalStore(understanding.subscribe, understanding.snapshot);
  return understanding;
}
