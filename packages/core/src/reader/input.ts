import type { ReaderInput, ReaderResult } from "@gigsync/protocol";
import { type ReaderLabels, readerResult } from "./decode.js";

export type { ReaderLabels };

/**
 * What the reader is given and what comes back, around the model run (ADR 0065): the same on the phone (in the
 * understanding pack's worker) and in `eval:find`, so the evals read messages exactly as phones do. The pair is built
 * as training built it (`training/reader/reader/data.py`): the message, then the open question's detail.
 */

/** What the reader needs of a tokenizer: Transformers.js's, which is the embedding model's, unchanged by training. */
export interface ReaderTokenizer {
  tokenize(text: string): string[];
  encode(text: string, options?: { add_special_tokens?: boolean }): number[];
}

/** The special tokens around a pair, as XLM-R writes them: <s> message </s></s> question </s>. */
const PAIR_SPECIALS = 4;

export interface ReaderIds {
  ids: number[];
  /** The message's tokens, in order, as many as fit. */
  tokens: string[];
}

/** The model's input for one message; undefined when the tokenizer's tokens and ids disagree. */
export function readerIds(tokenizer: ReaderTokenizer, labels: ReaderLabels, input: ReaderInput): ReaderIds | undefined {
  const question = input.asking ? input.asking.replaceAll("_", " ") : labels.no_question;
  const questionIds = tokenizer.encode(question, { add_special_tokens: false });
  // As training cut them: the message's tokens give way, never the question's.
  const room = labels.max_tokens - questionIds.length - PAIR_SPECIALS;
  const tokens = tokenizer.tokenize(input.text).slice(0, room);
  const messageIds = tokenizer.encode(input.text, { add_special_tokens: false }).slice(0, room);
  const empty = tokenizer.encode("");
  const [cls, sep] = [empty[0], empty.at(-1)];
  if (cls === undefined || sep === undefined || tokens.length !== messageIds.length) return undefined;
  return { ids: [cls, ...messageIds, sep, sep, ...questionIds, sep], tokens };
}

/** The model's three outputs for one message, flat as ONNX Runtime gives them. */
export interface ReaderRun {
  turn: ArrayLike<number>;
  work: ArrayLike<number>;
  /** One row per input token, `labels.tags.length` wide. */
  tags: Float32Array;
}

/** The reading from one run; the message's tokens follow <s>, one row of tag probabilities each. */
export function readingOf(
  input: ReaderInput,
  tokens: readonly string[],
  run: ReaderRun,
  labels: ReaderLabels,
): ReaderResult | undefined {
  const width = labels.tags.length;
  const tags = tokens.map((_, i) => run.tags.subarray((i + 1) * width, (i + 2) * width));
  return readerResult(input.text, tokens, { turn: run.turn, work: run.work, tags }, labels);
}
