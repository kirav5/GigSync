import { log } from "../log.js";
import type { Embedder } from "../ports.js";

/**
 * Nearest labelled saying by meaning (ADR 0042). A small embedding model on the phone turns each labelled saying and
 * each message into a unit vector; a message takes the label its closest sayings carry. Nothing here follows an
 * instruction or writes text: the other side's words, or an owner's, can only land near a label, never change one.
 * The sayings are embedded once per index and kept in memory for the app's life.
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
  private vectors: Promise<(readonly number[] | null)[]> | undefined;

  constructor(
    private readonly embedder: Embedder,
    private readonly sayings: readonly Labelled<L>[],
  ) {}

  /** Embeds the sayings on first use; a saying the embedder cannot embed is left out. */
  private all(): Promise<(readonly number[] | null)[]> {
    this.vectors ??= Promise.all(this.sayings.map((s) => this.embedder.embed(s.said).catch(() => null)));
    return this.vectors;
  }

  /**
   * The label whose sayings lie closest to `text`, among the labels `allowed` admits, by a similarity-weighted vote of
   * the nearest few; undefined when the device has no embedding model or nothing could be compared. A failed first
   * embedding is forgotten, so a model that becomes ready later is tried again.
   */
  async nearest(text: string, allowed: (label: L) => boolean): Promise<Nearest<L> | undefined> {
    const vector = await this.embedder.embed(text).catch((err: unknown) => {
      log.warn("meaning: embed failed", { error: err instanceof Error ? err.name : String(err) });
      return null;
    });
    if (!vector) return undefined;
    const vectors = await this.all();
    if (vectors.every((v) => v === null)) this.vectors = undefined;
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
