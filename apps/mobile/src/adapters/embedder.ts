import { Collection, type Embedder, log, type Storage } from "@gigsync/core";
import { env, type FeatureExtractionPipeline, pipeline } from "@huggingface/transformers";
import { useSyncExternalStore } from "react";
import { chosenModel, ModelChoice } from "./model.js";

/**
 * The understanding pack (ADR 0042): a small multilingual embedding model that runs inside this app, through ONNX
 * Runtime in the browser or webview, and turns a sentence into a vector core compares with its labelled sayings. It is
 * fetched once, on the owner's tap, and kept by the browser's cache; after that it loads from the device and nothing
 * typed ever leaves the phone. Lite mode turns it off like every other model.
 */

/** The model, as Hugging Face publishes its ONNX export; 8-bit weights, about 118 MB plus the tokenizer. */
export const EMBEDDING_MODEL = "Xenova/multilingual-e5-small";
export const EMBEDDING_PACK_MB = 129;
const DTYPE = "q8";
/** e5 models expect this prefix on the text they embed for a lookup. */
const QUERY_PREFIX = "query: ";
const POOLING = "mean";
const PERCENT = 100;
/** Remembers that the owner fetched the pack, so later launches load it from the cache without asking again. */
const SETTINGS_KEY = "understanding_pack";
/** Where Transformers.js keeps fetched files (its browser Cache name), and the files this model needs. */
const TRANSFORMERS_CACHE = "transformers-cache";
const MODEL_FILES = ["config.json", "tokenizer_config.json", "tokenizer.json", "onnx/model_quantized.onnx"];
const REVISION = "main";

export const PackState = {
  /** Not fetched; a tap fetches it. */
  downloadable: "downloadable",
  downloading: "downloading",
  ready: "ready",
  /** The fetch or the runtime failed; a tap tries again. */
  failed: "failed",
} as const;
export type PackState = (typeof PackState)[keyof typeof PackState];

interface Progress {
  progress?: number;
}

/**
 * Transformers.js types `pipeline` for every task at once, which TypeScript cannot resolve for one call; this is the
 * one shape the pack uses.
 */
type LoadExtractor = (
  task: "feature-extraction",
  model: string,
  options: { dtype: string; progress_callback: (p: Progress) => void },
) => Promise<FeatureExtractionPipeline>;
const loadExtractor = pipeline as unknown as LoadExtractor;

/** The embedding model's state on this device, and the `Embedder` the agent's ports hand to core. */
export class UnderstandingPack implements Embedder {
  state: PackState = PackState.downloadable;
  /** Of the download, 0 to 100, while downloading. */
  percent = 0;
  private pipe: Promise<FeatureExtractionPipeline> | undefined;
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
      const base = `${env.remoteHost}${EMBEDDING_MODEL}/resolve/${REVISION}/`;
      const found = await Promise.all(MODEL_FILES.map((file) => cache.match(`${base}${file}`)));
      return found.every((hit) => hit !== undefined);
    } catch {
      return false;
    }
  }

  private async start(): Promise<void> {
    if (this.pipe) return;
    this.set(PackState.downloading, 0);
    // Files come from the browser's cache when it has them, else from the model's host: `load` only gets here when
    // the cache is complete, so the network is reached from the owner's tap alone.
    env.allowRemoteModels = true;
    env.allowLocalModels = false;
    this.pipe = loadExtractor("feature-extraction", EMBEDDING_MODEL, {
      dtype: DTYPE,
      progress_callback: (p) => {
        if (p.progress !== undefined) this.set(PackState.downloading, Math.round(p.progress));
      },
    });
    try {
      await this.pipe;
      this.set(PackState.ready, PERCENT);
    } catch (err) {
      log.warn("understanding pack: load failed", { error: err instanceof Error ? err.name : String(err) });
      this.pipe = undefined;
      this.set(PackState.failed, 0);
    }
  }

  async embed(text: string): Promise<readonly number[] | null> {
    if (this.state !== PackState.ready || !this.pipe || chosenModel.current.choice === ModelChoice.lite) return null;
    const run = await this.pipe;
    const out = await run(QUERY_PREFIX + text, { pooling: POOLING, normalize: true });
    return Array.from(out.data as Float32Array);
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
