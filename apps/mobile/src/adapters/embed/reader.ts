/// <reference lib="webworker" />
import { type ReaderLabels, readerIds, readingOf } from "@gigsync/core/reader";
import type { ReaderInput, ReaderResult } from "@gigsync/protocol";
import type { PreTrainedTokenizer } from "@huggingface/transformers";
import { InferenceSession, Tensor } from "onnxruntime-web";

/**
 * The phone's reader (ADR 0065), inside the understanding pack's worker: GigSync's fine-tuned copy of the embedding
 * model, 8-bit, fetched once from GigSync's model host and kept in the browser's Cache Storage, then read from the
 * device; or, in a native app, read from the files it came with (`pnpm models:bundle`). Its tokenizer is the
 * embedding model's, unchanged by training, so only the weights and the labels are fetched. ONNX Runtime is the one Transformers.js loads, so both models share its settings and its WebAssembly.
 */

const MODEL_FILE = "onnx/model_quantized.onnx";
const LABELS_FILE = "labels.json";
/** Where the reader's files are kept; a new reader is a new folder on the host, so its files never mix. */
const READER_CACHE = "gigsync-reader";
const WASM = "wasm";
const PERCENT = 100;
const INPUT_IDS = "input_ids";
const ATTENTION_MASK = "attention_mask";
const TURN = "turn_probs";
const WORK = "work_probs";
const TAGS = "tag_probs";

export interface LoadedReader {
  session: InferenceSession;
  labels: ReaderLabels;
  tokenizer: PreTrainedTokenizer;
}

/** Where the reader's files may come from: the network when `fetchIt`, kept in the browser's cache when `keep`. */
export interface ReaderSource {
  fetchIt: boolean;
  keep: boolean;
}

/**
 * A file from the device's cache, or else from the host when `fetchIt` allows, kept for later launches when `keep`
 * (the app's own files are on the device already). Progress is reported for the weights, most of the download.
 */
async function cachedFile(url: string, from: ReaderSource, progress?: (percent: number) => void): Promise<Response> {
  if (!from.keep) {
    const own = await fetch(url);
    if (!own.ok) throw new Error(`reader file ${own.status}`);
    return own;
  }
  const cache = await caches.open(READER_CACHE);
  const kept = await cache.match(url);
  if (kept) return kept;
  if (!from.fetchIt) throw new Error("reader not on this device");
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`reader fetch ${response.status}`);
  const total = Number(response.headers.get("content-length") ?? 0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (total && progress) progress(Math.round((PERCENT * got) / total));
  }
  const body = new Blob(chunks as BlobPart[]);
  await cache.put(url, new Response(body, { headers: response.headers }));
  return new Response(body);
}

export async function loadReader(
  url: string,
  from: ReaderSource,
  tokenizer: PreTrainedTokenizer,
  progress: (percent: number) => void,
): Promise<LoadedReader> {
  const labels = (await (await cachedFile(`${url}/${LABELS_FILE}`, from)).json()) as ReaderLabels;
  const weights = await (await cachedFile(`${url}/${MODEL_FILE}`, from, progress)).arrayBuffer();
  const session = await InferenceSession.create(new Uint8Array(weights), { executionProviders: [WASM] });
  return { session, labels, tokenizer };
}

const int64 = (values: readonly number[]) =>
  new Tensor("int64", BigInt64Array.from(values.map(BigInt)), [1, values.length]);

/** One message read; undefined when the outputs do not make a reading. */
export async function readOne(r: LoadedReader, input: ReaderInput): Promise<ReaderResult | undefined> {
  const built = readerIds(r.tokenizer, r.labels, input);
  if (!built) return undefined;
  const mask = built.ids.map(() => 1);
  const out = await r.session.run({ [INPUT_IDS]: int64(built.ids), [ATTENTION_MASK]: int64(mask) });
  const [turn, work, tags] = [out[TURN], out[WORK], out[TAGS]];
  if (!turn || !work || !tags) return undefined;
  const run = { turn: turn.data as Float32Array, work: work.data as Float32Array, tags: tags.data as Float32Array };
  return readingOf(input, built.tokens, run, r.labels);
}
