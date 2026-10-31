// A Node `Embedder` for the eval: the same model the app's understanding pack loads (apps/mobile/src/adapters/
// embedder.ts), through Transformers.js on this machine. Its weights are fetched once into Transformers.js's cache.
import { core } from "./core.mjs";

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "Xenova/multilingual-e5-small";
const DTYPE = "q8";
const QUERY_PREFIX = "query: ";
const POOLING = "mean";

/** The embedder and the indexes core builds over its sayings, or undefined when Transformers.js is not installed. */
export async function loadMeaning() {
  let transformers;
  try {
    transformers = await import("@huggingface/transformers");
  } catch {
    return undefined;
  }
  const extractor = await transformers.pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: DTYPE });
  const embedder = {
    async embed(text) {
      const out = await extractor(QUERY_PREFIX + text, { pooling: POOLING, normalize: true });
      return Array.from(out.data);
    },
  };
  return { embedder, intents: core.intentIndex(embedder) };
}
