import {
  AskKind,
  DetailFlag,
  isModelQuestion,
  Lang,
  type ModelQuestion,
  type Question,
  type QuestionKey,
  SKIPPED,
} from "@gigsync/protocol";
import { recall } from "../memory/recall.js";
import { matchWords } from "./answer-model.js";
import type { JobContext } from "./context.js";
import { countIn } from "./details.js";
import { topicOf } from "./guard-words.js";
import { AnswerSource, type Need } from "./store.js";

/**
 * The household's agent answers the worker's agent only from what its owner actually said: this need's words and
 * details, or a stable fact from a past job (rooms, pets, people, meals, area, route). Everything else is the owner's
 * to answer. Each answer says where it came from, for the job's story.
 */

export interface Found {
  text: string;
  source: AnswerSource;
}

/** The on-device models read and answer English only today (HLD 7.6). */
const MODEL_LANG = Lang.enum.en;
const A = AskKind.enum;

const usable = (value: string | undefined): value is string =>
  value !== undefined && value.trim().length > 0 && value !== SKIPPED;

/** A known value as an answer of the asked kind: a number for a number, yes or no for a yes-or-no; else nothing. */
function asKind(q: Question, value: string): string | undefined {
  if (!isModelQuestion(q) || q.kind === A.text) return value;
  if (q.kind === A.number) {
    const n = countIn(value);
    return n === undefined ? undefined : String(n);
  }
  return DetailFlag.safeParse(value).success ? value : undefined;
}

/** A standard detail the question is about: its own key, or the detail a written question names. */
const topic = (q: Question): QuestionKey | undefined => (isModelQuestion(q) ? topicOf(q.text) : q.key);

function fromKnown(q: Question, need: Need, facts: Partial<Record<QuestionKey, string>>): Found | undefined {
  const key = topic(q);
  if (!key) return undefined;
  const said = need.details[key];
  const saidText = usable(said) ? asKind(q, said) : undefined;
  if (saidText) return { text: saidText, source: AnswerSource.words };
  const remembered = facts[key];
  const rememberedText = usable(remembered) ? asKind(q, remembered) : undefined;
  return rememberedText ? { text: rememberedText, source: AnswerSource.memory } : undefined;
}

/** The owner's own words for this need, as the model may quote them. */
const wordsOf = (need: Need) => [need.need, ...Object.entries(need.details).map(([k, v]) => `${k}: ${v}`)].join("\n");

/** Answers the household's agent can give itself, by question key; the rest go to the owner. */
export async function answersFound(ctx: JobContext, need: Need, questions: readonly Question[]) {
  const { facts } = await recall(ctx, need.trade);
  const found: Record<string, Found> = {};
  for (const q of questions) {
    const known = fromKnown(q, need, facts);
    if (known) found[q.key] = known;
  }
  const open = questions.filter((q): q is ModelQuestion => isModelQuestion(q) && !found[q.key]);
  if (ctx.model && ctx.lang === MODEL_LANG && open.length > 0) {
    const matched = await matchWords(ctx.model, wordsOf(need), open);
    for (const [key, text] of Object.entries(matched)) found[key] = { text, source: AnswerSource.words };
  }
  return found;
}
