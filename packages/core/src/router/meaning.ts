import { log } from "../log.js";
import type { Embedder } from "../ports.js";

/**
 * Nearest labelled saying by meaning (ADR 0042). A small embedding model on the phone turns each labelled saying and
 * each message into a unit vector; a message takes the label its closest sayings carry. Nothing here follows an
 * instruction or writes text: the other side's words, or an owner's, can only land near a label, never change one.
 * The sayings are embedded once per index, in the background and a batch at a time, and kept for the app's life. A
 * lookup never waits for them: until they are ready it finds nothing, and the word lists answer as they always did.
 * (Waiting froze an iPhone's chat for tens of seconds on the first message: hundreds of sayings, one model run each.)
 */

/** A saying and the label it carries. */
export interface Labelled<L extends string> {
  said: string;
  label: L;
}

/** What the index found for one text: the winning label, how close the nearest saying was, and the vote behind it. */
export interface Nearest<L extends string> {
  label: L;
  /** Cosine similarity to the single closest saying, 0 to 1 for unit vectors. */
  top: number;
}

/** Sayings embedded per call: big enough for the model to batch, small enough to keep each call short. */
const BATCH = 32;

/** How many close sayings vote on the label; one would let a single odd saying decide. */
export const NEAREST_K = 3;

/** Cosine similarity of two unit vectors; the vectors an embedder returns are normalized already. */
export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
}

/** Labelled sayings as vectors, embedded once, with lookups by meaning. */
export class MeaningIndex<L extends string> {
  private vectors: Promise<void> | undefined;
  private ready: (readonly number[] | null)[] | undefined;

  constructor(
    private readonly embedder: Embedder,
    private readonly sayings: readonly Labelled<L>[],
  ) {}

  /** The sayings in batches, one batch at a time; a saying the embedder cannot embed is left out (null). */
  private async embedAll(): Promise<(readonly number[] | null)[]> {
    const out: (readonly number[] | null)[] = [];
    for (let i = 0; i < this.sayings.length; i += BATCH) {
      const texts = this.sayings.slice(i, i + BATCH).map((s) => s.said);
      const many = this.embedder.embedMany?.bind(this.embedder);
      if (many) out.push(...(await many(texts).catch(() => texts.map(() => null))));
      else for (const text of texts) out.push(await this.embedder.embed(text).catch(() => null));
    }
    return out;
  }

  /**
   * Starts embedding the sayings, if not started, and resolves when done. A run that embedded nothing (no model ready
   * yet) is forgotten, so a model that becomes ready later is tried again.
   */
  warm(): Promise<void> {
    this.vectors ??= this.embedAll().then((vectors) => {
      if (vectors.every((v) => v === null)) this.vectors = undefined;
      else this.ready = vectors;
    });
    return this.vectors;
  }

  /**
   * The label whose sayings lie closest to `text`, among the labels `allowed` admits, by a similarity-weighted vote of
   * the nearest few; undefined when the device has no embedding model, the sayings are not embedded yet (that starts
   * now, in the background), or nothing could be compared.
   */
  async nearest(text: string, allowed: (label: L) => boolean): Promise<Nearest<L> | undefined> {
    const vectors = this.ready;
    if (!vectors) {
      void this.warm();
      return undefined;
    }
    const vector = await this.embedder.embed(text).catch((err: unknown) => {
      log.warn("meaning: embed failed", { error: err instanceof Error ? err.name : String(err) });
      return null;
    });
    if (!vector) return undefined;
    const scored = this.sayings
      .map((s, i) => ({ label: s.label, vector: vectors[i] }))
      .filter((s): s is { label: L; vector: readonly number[] } => s.vector !== null && allowed(s.label))
      .map((s) => ({ label: s.label, sim: cosine(vector, s.vector) }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, NEAREST_K);
    const first = scored[0];
    if (!first) return undefined;
    const votes = new Map<L, number>();
    for (const s of scored) votes.set(s.label, (votes.get(s.label) ?? 0) + s.sim);
    const winner = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    return winner ? { label: winner[0], top: first.sim } : undefined;
  }
}
