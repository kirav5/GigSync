import {
  AnswerFromMemory,
  AskKind,
  DetailFlag,
  isModelQuestion,
  Lang,
  type ModelQuestion,
  type Question,
  type QuestionKey,
  SKIPPED,
} from "@gigsync/protocol";
import { householdKnown, type Known } from "../memory/known.js";
import { matchWords } from "./answer-model.js";
import type { JobContext } from "./context.js";
import { countIn } from "./details.js";
import { topicOf } from "./guard-words.js";
import { AnswerSource, type Need, type Suggested } from "./store.js";

/**
 * The household's agent answers the worker's agent only from what its owner actually said: this need's words and
 * details, always on its own, or a stable fact from a past job (rooms, pets, people, meals, area, route), on its own
 * only when the owner chose "Answer for me" and the fact is less than a year old. With "Ask me first" a remembered
 * answer waits for the owner, filled in. Everything else is the owner's to answer. Each answer says where it came
 * from, for the job's story.
 */

export interface Found {
  text: string;
  source: AnswerSource;
}

/** What the agent can send itself, and what it holds for the owner to confirm, by question key. */
export interface AnswersFound {
  found: Record<string, Found>;
  suggested: Record<string, Suggested>;
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

/** The answer this need's own details give, if any. */
function fromWords(q: Question, need: Need): string | undefined {
  const key = topic(q);
  const said = key ? need.details[key] : undefined;
  return usable(said) ? asKind(q, said) : undefined;
}

/** The answer a past job's fact gives, if any, and whether it is recent enough to use on its own. */
function fromMemory(q: Question, facts: Partial<Record<QuestionKey, Known>>): Suggested | undefined {
  const key = topic(q);
  const known = key ? facts[key] : undefined;
  const text = known && usable(known.value) ? asKind(q, known.value) : undefined;
  return known && text ? { text, fresh: known.fresh } : undefined;
}

/** The owner's own words for this need, as the model may quote them. */
const wordsOf = (need: Need) => [need.need, ...Object.entries(need.details).map(([k, v]) => `${k}: ${v}`)].join("\n");

/** Answers the household's agent can give itself, and remembered ones it holds for the owner; the rest go to the owner. */
export async function answersFound(ctx: JobContext, need: Need, questions: readonly Question[]): Promise<AnswersFound> {
  const { facts, mode } = await householdKnown(ctx);
  const found: Record<string, Found> = {};
  const suggested: Record<string, Suggested> = {};
  for (const q of questions) {
    const said = fromWords(q, need);
    const remembered = said ? undefined : fromMemory(q, facts);
    if (said) found[q.key] = { text: said, source: AnswerSource.words };
    else if (remembered && mode === AnswerFromMemory.enum.ask) suggested[q.key] = remembered;
    else if (remembered?.fresh) found[q.key] = { text: remembered.text, source: AnswerSource.memory };
  }
  const open = questions.filter((q): q is ModelQuestion => isModelQuestion(q) && !found[q.key]);
  if (ctx.model && ctx.lang === MODEL_LANG && open.length > 0) {
    const matched = await matchWords(ctx.model, wordsOf(need), open);
    for (const [key, text] of Object.entries(matched)) found[key] = { text, source: AnswerSource.words };
  }
  // The owner's words for this need win over a past job's, as they do for standard details.
  return { found, suggested: Object.fromEntries(Object.entries(suggested).filter(([key]) => !found[key])) };
}
