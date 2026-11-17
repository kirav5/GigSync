/// <reference lib="webworker" />

import type { ReaderInput } from "@gigsync/protocol";
import { env, type FeatureExtractionPipeline, pipeline } from "@huggingface/transformers";
import {
  type Bundled,
  EMBEDDING_MODEL,
  FromWorker,
  type FromWorkerMessage,
  ToWorker,
  type ToWorkerMessage,
} from "./messages.js";
import { type LoadedReader, loadReader, readOne } from "./reader.js";

/**
 * The understanding pack's model, in a worker (ADR 0042): loads the embedding model and turns texts into vectors off
 * the page, a batch per call. Vectors of fixed sayings are kept in the browser's Cache Storage (not the app's settings
 * storage, which is small), so they are made once per device; an owner's own words are embedded and forgotten.
 */

const DTYPE = "q8";
/** e5 models expect this prefix on the text they embed for a lookup. */
const QUERY_PREFIX = "query: ";
const POOLING = "mean";
/** Where kept vectors live, by model and text; a new model gets a new name, so old vectors are never mixed in. */
const vectorsCache = (model: string) => `gigsync-vectors-${model.replace("/", "-")}-${DTYPE}`;
let VECTORS_CACHE = vectorsCache(EMBEDDING_MODEL);
/** A name of our own for the cache's keys; never fetched. */
const VECTORS_ORIGIN = "https://vectors.gigsync.internal/";

interface Progress {
  progress?: number;
}
/** Transformers.js types `pipeline` for every task at once; this is the one shape the pack uses. */
type LoadExtractor = (
  task: "feature-extraction",
  model: string,
  options: { dtype: string; progress_callback: (p: Progress) => void },
) => Promise<FeatureExtractionPipeline>;
const loadExtractor = pipeline as unknown as LoadExtractor;

const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: FromWorkerMessage) => scope.postMessage(m);
const nameOf = (err: unknown) => (err instanceof Error ? err.name : String(err));
let pipe: Promise<FeatureExtractionPipeline> | undefined;

/**
 * Points Transformers.js at the app's own files, with no network and no second copy: the models, and ONNX Runtime's
 * WebAssembly, which the build already ships beside this worker (Transformers.js would fetch it from a CDN instead).
 */
function fromBundle(bundled: Bundled): string {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = bundled.base;
  env.useBrowserCache = false;
  const wasm = env.backends.onnx.wasm;
  if (wasm) delete wasm.wasmPaths;
  VECTORS_CACHE = vectorsCache(bundled.embedder);
  return bundled.embedder;
}

async function load(bundled: Bundled | undefined): Promise<void> {
  // Files come from the app's bundle, or else from the browser's cache when it has them, else from the model's host:
  // the app asks for a load only when the cache is complete, or on the owner's tap.
  env.allowRemoteModels = true;
  env.allowLocalModels = false;
  const model = bundled ? fromBundle(bundled) : EMBEDDING_MODEL;
  pipe ??= loadExtractor("feature-extraction", model, {
    dtype: DTYPE,
    progress_callback: (p) => {
      if (p.progress !== undefined) post({ type: FromWorker.progress, percent: Math.round(p.progress) });
    },
  });
  try {
    await pipe;
    post({ type: FromWorker.ready });
  } catch (err) {
    pipe = undefined;
    post({ type: FromWorker.failed, error: nameOf(err) });
  }
}

const keyOf = (text: string) => new Request(`${VECTORS_ORIGIN}${encodeURIComponent(text)}`);

/** Vectors kept from an earlier launch, null where none is kept. */
async function keptVectors(cache: Cache | undefined, texts: readonly string[]): Promise<(number[] | null)[]> {
  if (!cache) return texts.map(() => null);
  const hits = await Promise.all(texts.map((t) => cache.match(keyOf(t))));
  return Promise.all(hits.map((h) => (h ? (h.json() as Promise<number[]>) : null)));
}

async function embed(id: number, texts: readonly string[], keep: boolean): Promise<void> {
  try {
    if (!pipe) throw new Error("model not loaded");
    const cache = keep ? await caches.open(VECTORS_CACHE).catch(() => undefined) : undefined;
    const out = await keptVectors(cache, texts);
    const missing = out.flatMap((v, i) => (v ? [] : [i]));
    if (missing.length > 0) {
      const run = await pipe;
      const made = await run(
        missing.map((i) => QUERY_PREFIX + texts[i]),
        { pooling: POOLING, normalize: true },
      );
      const rows = made.tolist() as number[][];
      await Promise.all(
        missing.map(async (i, j) => {
          const row = rows[j] ?? null;
          out[i] = row;
          if (cache && row) await cache.put(keyOf(texts[i] ?? ""), Response.json(row)).catch(() => undefined);
        }),
      );
    }
    post({ type: FromWorker.vectors, id, vectors: out });
  } catch (err) {
    post({ type: FromWorker.error, id, error: nameOf(err) });
  }
}

let reader: Promise<LoadedReader> | undefined;

/** The reader, after the embedding model whose tokenizer it uses; from the device only unless `fetchIt`. */
async function startReader(url: string, fetchIt: boolean, keep: boolean): Promise<void> {
  try {
    if (!pipe) throw new Error("model not loaded");
    const { tokenizer } = await pipe;
    const progress = (percent: number) => post({ type: FromWorker.readerProgress, percent });
    reader ??= loadReader(url, { fetchIt, keep }, tokenizer, progress);
    await reader;
    post({ type: FromWorker.readerReady });
  } catch (err) {
    reader = undefined;
    post({ type: FromWorker.readerFailed, error: nameOf(err) });
  }
}

async function read(id: number, input: ReaderInput): Promise<void> {
  try {
    if (!reader) throw new Error("reader not loaded");
    post({ type: FromWorker.reading, id, result: (await readOne(await reader, input)) ?? null });
  } catch (err) {
    post({ type: FromWorker.error, id, error: nameOf(err) });
  }
}

scope.onmessage = (e: MessageEvent<ToWorkerMessage>) => {
  const m = e.data;
  switch (m.type) {
    case ToWorker.load:
      return void load(m.bundled);
    case ToWorker.embed:
      return void embed(m.id, m.texts, m.keep);
    case ToWorker.loadReader:
      return void startReader(m.url, m.fetch, m.keep);
    case ToWorker.read:
      return void read(m.id, m.input);
  }
};
