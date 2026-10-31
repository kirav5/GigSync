import {
  ASK_TEXT_MAX,
  ASK_TEXT_MIN,
  AskedBy,
  AskKind,
  Lang,
  type ModelQuestion,
  type QuestionKey,
} from "@gigsync/protocol";
import { z } from "zod";
import { firstObject } from "../interview/need-model.js";
import { asciiDigits } from "./details.js";
import { DENY, DropReason, topicOf } from "./guard-words.js";

/**
 * The guards between the worker's agent's model and the household ("models propose, code decides"): a pure check of
 * the model's raw reply. A question survives only when it is short, ends as a question, is new, is not about a detail
 * already known, and touches none of money, contacts, the address, identity, meeting or paying outside the app, links
 * or long numbers. Anything else is dropped; with nothing left the agent asks its standard questions instead.
 */

/** Written questions per request, at most. */
export const MODEL_QUESTIONS_MAX = 3;
/** A model question's key: `ask_` and a letter, fresh per request and never a standard key. */
const ASK_KEY_PREFIX = "ask_";
const KEY_LETTERS = "abcdefghijklmnopqrstuvwxyz";
/** What a small model may send before it is clearly not the object asked for. */
const CANDIDATES_MAX = 10;
/** A question mark in any script the model may write: ASCII, full-width, Arabic. */
const ENDS_AS_QUESTION = /[?？؟]$/u;
/** Small counts (up to two digits) are fine; a longer run, or digits spaced out, may be a phone or an account. */
const LONG_DIGITS = /\d{3,}|(?:\d[\s.-]?){5,}/;
/** A sentence that ends and goes on: one question asks one thing. */
const TWO_SENTENCES = /[.!?।]\s+\S/u;
const SPACES = /\s+/g;
const ONE_SPACE = " ";
const NOT_WORD = /[^\p{L}\p{N}]+/gu;
const SCRIPT_LANG: ReadonlyArray<readonly [RegExp, Lang]> = [
  [/\p{Script=Kannada}/u, Lang.enum.kn],
  [/\p{Script=Devanagari}/u, Lang.enum.hi],
];

const Candidate = z.object({ text: z.string(), kind: AskKind });
const Reply = z.object({ questions: z.array(z.unknown()).max(CANDIDATES_MAX) });

export interface Dropped {
  text: string;
  reason: DropReason;
}

export interface Guarded {
  kept: ModelQuestion[];
  dropped: Dropped[];
}

/** The language a question is written in, by its script; Latin (or none) is the model's English. */
export const langOf = (text: string): Lang => SCRIPT_LANG.find(([script]) => script.test(text))?.[1] ?? Lang.enum.en;
const sameness = (text: string) => text.toLowerCase().replace(NOT_WORD, ONE_SPACE).trim();

/** What the guards check a question against. */
export interface GuardRules {
  /** Standard details already given, remembered, or asked in the same request. */
  known?: readonly QuestionKey[];
  /** How many questions there is room for (never more than `MODEL_QUESTIONS_MAX`). */
  max?: number;
  /** The household's own words: a question that only repeats them asks nothing. */
  said?: string;
}

interface Seen {
  known: ReadonlySet<QuestionKey>;
  said: string;
  asked: ReadonlySet<string>;
}

/** Why one question must not reach the household, or undefined when it may. */
function problemWith(text: string, seen: Seen): DropReason | undefined {
  if (text.length < ASK_TEXT_MIN || text.length > ASK_TEXT_MAX) return DropReason.length;
  if (!ENDS_AS_QUESTION.test(text)) return DropReason.mark;
  if (TWO_SENTENCES.test(text)) return DropReason.compound;
  const same = sameness(text);
  if (seen.asked.has(same)) return DropReason.duplicate;
  if (seen.said && (seen.said.includes(same) || same.includes(seen.said))) return DropReason.echo;
  const denied = DENY.find(([, patterns]) => patterns.some((p) => p.test(text)));
  if (denied) return denied[0];
  if (LONG_DIGITS.test(asciiDigits(text))) return DropReason.digits;
  const topic = topicOf(text);
  if (topic && seen.known.has(topic)) return DropReason.known;
  return undefined;
}

/** Why one question on its own must not reach its reader (length, mark, money, contacts, long numbers), if any. */
export const questionProblem = (text: string, known: readonly QuestionKey[] = []): DropReason | undefined =>
  problemWith(text.replace(SPACES, ONE_SPACE).trim(), { known: new Set(known), said: "", asked: new Set() });

function parse(reply: string): unknown[] | undefined {
  const object = firstObject(reply);
  if (!object) return undefined;
  try {
    const parsed = Reply.safeParse(JSON.parse(object));
    return parsed.success ? parsed.data.questions : undefined;
  } catch {
    return undefined;
  }
}

/** The model's questions that pass every guard, at most `max`, each with a fresh key; and what was dropped and why. */
export function guardQuestions(reply: string, rules: GuardRules = {}): Guarded {
  const kept: ModelQuestion[] = [];
  const dropped: Dropped[] = [];
  const asked = new Set<string>();
  const seen: Seen = { known: new Set(rules.known ?? []), said: sameness(rules.said ?? ""), asked };
  const limit = Math.min(rules.max ?? MODEL_QUESTIONS_MAX, MODEL_QUESTIONS_MAX);
  for (const raw of parse(reply) ?? []) {
    const candidate = Candidate.safeParse(raw);
    if (!candidate.success) {
      dropped.push({ text: String(JSON.stringify(raw)).slice(0, ASK_TEXT_MAX), reason: DropReason.shape });
      continue;
    }
    const text = candidate.data.text.replace(SPACES, ONE_SPACE).trim();
    const reason = kept.length >= limit ? DropReason.over : problemWith(text, seen);
    if (reason) {
      dropped.push({ text, reason });
      continue;
    }
    asked.add(sameness(text));
    const key = ASK_KEY_PREFIX + KEY_LETTERS[kept.length];
    kept.push({ key, text, lang: langOf(text), kind: candidate.data.kind, by: AskedBy.enum.model });
  }
  return { kept, dropped };
}
