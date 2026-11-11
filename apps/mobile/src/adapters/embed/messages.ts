import type { ReaderInput, ReaderResult } from "@gigsync/protocol";

/**
 * What the app and the understanding pack's worker (embed/worker.ts) say to each other. The model runs in the worker
 * so that loading it and embedding never hold up the page: on an iPhone, embedding on the page froze typing.
 */

/** The model, as Hugging Face publishes its ONNX export; 8-bit weights, about 118 MB plus the tokenizer. */
export const EMBEDDING_MODEL = "Xenova/multilingual-e5-small";

/** The phone's reader (ADR 0065): a fine-tuned copy of the same model, run beside it with the same tokenizer. */
export const ToWorker = { load: "load", embed: "embed", loadReader: "load_reader", read: "read" } as const;
export const FromWorker = {
  progress: "progress",
  ready: "ready",
  failed: "failed",
  vectors: "vectors",
  error: "error",
  readerProgress: "reader_progress",
  readerReady: "reader_ready",
  readerFailed: "reader_failed",
  reading: "reading",
} as const;

export type ToWorkerMessage =
  | { type: typeof ToWorker.load }
  /** `keep`: fixed sayings, whose vectors the worker keeps for later launches; never set for an owner's own words. */
  | { type: typeof ToWorker.embed; id: number; texts: readonly string[]; keep: boolean }
  /** `url`: the folder the reader's files are in; `fetch`: false loads it only from the device, never the network. */
  | { type: typeof ToWorker.loadReader; url: string; fetch: boolean }
  | { type: typeof ToWorker.read; id: number; input: ReaderInput };

export type FromWorkerMessage =
  | { type: typeof FromWorker.progress; percent: number }
  | { type: typeof FromWorker.ready }
  | { type: typeof FromWorker.failed; error: string }
  | { type: typeof FromWorker.vectors; id: number; vectors: (number[] | null)[] }
  | { type: typeof FromWorker.error; id: number; error: string }
  | { type: typeof FromWorker.readerProgress; percent: number }
  | { type: typeof FromWorker.readerReady }
  | { type: typeof FromWorker.readerFailed; error: string }
  /** The reading, or null when there is none (no reader loaded, or a reading that did not check). */
  | { type: typeof FromWorker.reading; id: number; result: ReaderResult | null };
