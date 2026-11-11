// The phone's reader for eval:find (ADR 0065): the trained reader's 8-bit file through ONNX Runtime on this machine,
// with the embedding model's tokenizer and core's input and decoding (`readerIds`, `readingOf`), so the eval reads a
// message as the understanding pack's worker does. With it come the matchers the app uses when the reader is unsure:
// the trades and the listed skills by meaning. The reader's files stay on the founder's machine: READER_MODEL names
// the folder `training/reader` wrote (default data/reader/model-v3).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { EMBEDDING_MODEL, loadMeaning } from "../eval-intent/embedder.mjs";
import { core } from "./core.mjs";

export const READER_MODEL = process.env.READER_MODEL ?? "data/reader/model-v3";
const MODEL_FILE = "onnx/model_quantized.onnx";

/** The reader and the meaning indexes; `list` is what workers list in the eval's conversations. */
export async function loadPhone(list) {
  const transformers = await import("@huggingface/transformers");
  // ONNX Runtime for Node comes with Transformers.js, as the web one does in the app.
  const ort = createRequire(import.meta.resolve("@huggingface/transformers"))("onnxruntime-node");
  const tokenizer = await transformers.AutoTokenizer.from_pretrained(EMBEDDING_MODEL);
  const labels = JSON.parse(readFileSync(`${READER_MODEL}/labels.json`, "utf8"));
  const session = await ort.InferenceSession.create(`${READER_MODEL}/${MODEL_FILE}`);
  const int64 = (v) => new ort.Tensor("int64", BigInt64Array.from(v.map(BigInt)), [1, v.length]);
  const reader = {
    async read(input) {
      const built = core.readerIds(tokenizer, labels, input);
      if (!built) return null;
      const out = await session.run({ input_ids: int64(built.ids), attention_mask: int64(built.ids.map(() => 1)) });
      const run = { turn: out.turn_probs.data, work: out.work_probs.data, tags: out.tag_probs.data };
      return core.readingOf(input, built.tokens, run, labels) ?? null;
    },
  };
  const { embedder } = await loadMeaning();
  const trades = core.tradeIndex(embedder);
  const skills = core.skillIndex(embedder, list);
  await Promise.all([trades.warm(), skills.warm()]);
  return { reader, trades, skills };
}

/** One message as the app reads it: the reader for English, the model for the rest (`readMessage`). */
export const phoneRead = (phone, text, slot, byModel) => core.readMessage(phone.reader, text, slot, byModel);
