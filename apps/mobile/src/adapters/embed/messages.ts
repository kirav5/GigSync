/**
 * What the app and the understanding pack's worker (embed/worker.ts) say to each other. The model runs in the worker
 * so that loading it and embedding never hold up the page: on an iPhone, embedding on the page froze typing.
 */

/** The model, as Hugging Face publishes its ONNX export; 8-bit weights, about 118 MB plus the tokenizer. */
export const EMBEDDING_MODEL = "Xenova/multilingual-e5-small";

export const ToWorker = { load: "load", embed: "embed" } as const;
export const FromWorker = {
  progress: "progress",
  ready: "ready",
  failed: "failed",
  vectors: "vectors",
  error: "error",
} as const;

export type ToWorkerMessage =
  | { type: typeof ToWorker.load }
  /** `keep`: fixed sayings, whose vectors the worker keeps for later launches; never set for an owner's own words. */
  | { type: typeof ToWorker.embed; id: number; texts: readonly string[]; keep: boolean };

export type FromWorkerMessage =
  | { type: typeof FromWorker.progress; percent: number }
  | { type: typeof FromWorker.ready }
  | { type: typeof FromWorker.failed; error: string }
  | { type: typeof FromWorker.vectors; id: number; vectors: (number[] | null)[] }
  | { type: typeof FromWorker.error; id: number; error: string };
