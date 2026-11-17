import { AskKind, DetailFlag, DetailKey, ModelPurpose, type ModelQuestion } from "@gigsync/protocol";
import { z } from "zod";
import { firstObject, MODEL_WAIT_MS, within } from "../interview/need-model.js";
import { normalize } from "../interview/normalize.js";
import { log } from "../log.js";
import type { Model } from "../ports.js";
import { numbersIn } from "./details.js";

const Purpose = ModelPurpose.enum;

/**
 * The household's agent may ask its model which of the owner's own words answer a written question, but the answer
 * it sends is always read from those words: a quote that is really in them, a number that is in the quote, or a yes
 * the quote supports. Never a "no": that something was not said is not an answer. Anything else goes to the owner.
 */

/** Short answers only: the quote and a value per question. */
const MAX_TOKENS = 200;
/** A quote shorter than this proves nothing; longer than this is not an answer to one question. */
const QUOTE_MIN = 3;
const QUOTE_MAX = 120;
const ANSWERS_MAX = 10;
const A = AskKind.enum;

const Item = z.object({
  key: DetailKey,
  answer: z.union([z.string(), z.number()]).nullish().catch(null),
  quote: z.string().nullish().catch(null),
});
const Reply = z.object({ answers: z.array(z.unknown()).max(ANSWERS_MAX) });

export function answerPrompt(words: string, questions: readonly ModelQuestion[]): string {
  const asked = questions.map((q) => `${q.key}: ${JSON.stringify(q.text)} (${q.kind})`);
  return [
    "A worker asked a household these questions. Answer each one ONLY from the household's own words below.",
    'If their words do not answer it, use null. "quote" must copy their exact words that answer it.',
    `Their words: ${JSON.stringify(words)}`,
    `Questions:\n${asked.join("\n")}`,
    'Reply with JSON only: {"answers": [{"key": "...", "answer": "yes" | number | "text" | null, "quote": "..." | null}]}',
  ].join("\n");
}

/** One item's answer, if it is read from the owner's words; undefined otherwise. */
function grounded(item: z.infer<typeof Item>, q: ModelQuestion, said: string): string | undefined {
  const quote = item.quote?.trim();
  if (!quote || quote.length < QUOTE_MIN || quote.length > QUOTE_MAX || !said.includes(normalize(quote)))
    return undefined;
  switch (q.kind) {
    case A.text:
      return quote;
    case A.number: {
      const n = Number(item.answer);
      return Number.isInteger(n) && numbersIn(quote).includes(n) ? String(n) : undefined;
    }
    case A.yes_no:
      return normalize(String(item.answer ?? "")) === DetailFlag.enum.yes ? DetailFlag.enum.yes : undefined;
  }
}

/** The answers in a model's reply that pass the grounding check, by question key. */
export function groundedAnswers(reply: string, words: string, questions: readonly ModelQuestion[]) {
  const object = firstObject(reply);
  if (!object) return {};
  let parsed: z.infer<typeof Reply> | undefined;
  try {
    parsed = Reply.safeParse(JSON.parse(object)).data;
  } catch {
    return {};
  }
  const said = normalize(words);
  const found: Record<string, string> = {};
  for (const raw of parsed?.answers ?? []) {
    const item = Item.safeParse(raw);
    const q = item.success ? questions.find((x) => x.key === item.data.key) : undefined;
    const text = item.success && q && !found[q.key] ? grounded(item.data, q, said) : undefined;
    if (q && text) found[q.key] = text;
  }
  return found;
}

/** What the model found in the owner's words, checked; empty without an answer in time. */
export async function matchWords(
  model: Model,
  words: string,
  questions: readonly ModelQuestion[],
  waitMs = MODEL_WAIT_MS,
): Promise<Record<string, string>> {
  if (questions.length === 0 || !words.trim()) return {};
  try {
    const reply = await within(
      model.generate(answerPrompt(words, questions), { maxTokens: MAX_TOKENS, purpose: Purpose.household_answers }),
      waitMs,
    );
    return reply ? groundedAnswers(reply, words, questions) : {};
  } catch (err) {
    log.warn("model answers failed", { error: (err as Error).name });
    return {};
  }
}
