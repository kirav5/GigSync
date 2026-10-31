import type { Embedder } from "../src/index.js";

/** Vector length of the fake: enough buckets that unrelated words rarely collide. */
const DIMENSIONS = 64;
const WORD = /[\p{L}\p{N}]+/gu;
/** FNV-1a offset and prime, for a stable hash of each word. */
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

function bucket(word: string): number {
  let h = FNV_OFFSET;
  for (const ch of word) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), FNV_PRIME);
  return Math.abs(h) % DIMENSIONS;
}

/**
 * A bag-of-words embedder: texts sharing words land close, texts sharing none are orthogonal. Deterministic and tiny,
 * so the meaning router's rules can be tested without a model; it says nothing about a real model's quality.
 */
export class BagOfWordsEmbedder implements Embedder {
  readonly texts: string[] = [];
  async embed(text: string): Promise<readonly number[] | null> {
    this.texts.push(text);
    const v = new Array<number>(DIMENSIONS).fill(0);
    for (const word of text.toLowerCase().match(WORD) ?? []) v[bucket(word)] += 1;
    const norm = Math.hypot(...v);
    return norm === 0 ? null : v.map((x) => x / norm);
  }
}

/** An embedder whose model is never ready. */
export class NoVectors implements Embedder {
  async embed(): Promise<null> {
    return null;
  }
}

/** An embedder that fails every call, as a broken runtime would. */
export class BrokenEmbedder implements Embedder {
  embed(): Promise<never> {
    return Promise.reject(new Error("runtime gone"));
  }
}
