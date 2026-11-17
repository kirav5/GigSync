import { Lang, ModelPurpose, PAISE_PER_RUPEE } from "@gigsync/protocol";
import { z } from "zod";
import { factsText } from "../i18n/terms-text.js";
import { statedNumbers } from "../interview/amount.js";
import { firstObject, MODEL_WAIT_MS, within } from "../interview/need-model.js";
import { log } from "../log.js";
import type { Model } from "../ports.js";
import { type Fact, FactKind } from "./explain.js";

const Purpose = ModelPurpose.enum;

/**
 * A model words an offer's facts for its owner, in their language (ADR 0033 §4). It gets the facts and the template
 * sentence built from them, never the other side's words. Its text is kept only when it passes the checker: in the
 * owner's script, short, and every number in it (digits in any script, ₹ amounts with commas, number words) is a
 * number of the facts. Anything else, or no answer in time, and the owner reads the template sentence.
 */

/** Who reads an explanation. Only its owner, today; the limit could never be shown to the other side. */
export const Audience = { owner: "owner", other: "other" } as const;
export type Audience = (typeof Audience)[keyof typeof Audience];

export const ExplainedBy = { model: "model", template: "template" } as const;
export type ExplainedBy = (typeof ExplainedBy)[keyof typeof ExplainedBy];

export interface Explanation {
  text: string;
  by: ExplainedBy;
}

/** Room for two short sentences as JSON. */
const MAX_TOKENS = 160;
/** Longer than this is not the short note asked for. */
export const EXPLAIN_MAX = 280;
const LETTER = /\p{L}/gu;
/** Letters of each language's own script; Hindi and Kannada text may still name a few English words. */
const SCRIPT: Readonly<Record<Lang, RegExp>> = {
  [Lang.enum.en]: /\p{Script=Latin}/u,
  [Lang.enum.hi]: /\p{Script=Devanagari}/u,
  [Lang.enum.kn]: /\p{Script=Kannada}/u,
};
/** At least this share of the letters must be in the owner's script. */
const MIN_SCRIPT_SHARE = 0.6;
/** Each language as a model is asked to write it. */
export const LANGUAGE_NAME: Readonly<Record<Lang, string>> = {
  [Lang.enum.en]: "English",
  [Lang.enum.hi]: "Hindi, in Devanagari script",
  [Lang.enum.kn]: "Kannada, in Kannada script",
};

const Reply = z.object({ text: z.string().min(1).max(EXPLAIN_MAX) });

/** Mostly in the owner's script. */
function inScript(text: string, lang: Lang): boolean {
  const letters = text.match(LETTER) ?? [];
  const own = letters.filter((ch) => SCRIPT[lang].test(ch)).length;
  return letters.length > 0 && own / letters.length >= MIN_SCRIPT_SHARE;
}

/** The limit's numbers in rupees: never in a text shown to anyone but its owner. */
const limitRupees = (facts: readonly Fact[]): number[] =>
  facts.flatMap((f) => (f.kind === FactKind.limit ? [f.limit_paise / PAISE_PER_RUPEE] : []));

export interface CheckInput {
  /** The template sentence for the same facts: the numbers in it are the only ones allowed. */
  template: string;
  lang: Lang;
  /** Numbers that must not appear at all (the owner's limit, for anyone else). */
  forbidden?: readonly number[];
}

/** The model's text passes: in the owner's script, short, every number one of the facts', nothing forbidden. */
export function checkExplanation(text: string, c: CheckInput): boolean {
  if (!text.trim() || text.length > EXPLAIN_MAX || !inScript(text, c.lang)) return false;
  const allowed = new Set(statedNumbers(c.template));
  const stated = statedNumbers(text);
  return stated.every((n) => allowed.has(n) && !c.forbidden?.includes(n));
}

/** Short and JSON-only: the facts as the template says them, to reword without adding anything. */
export function explainPrompt(template: string, lang: Lang): string {
  return [
    `Reword this note for a person whose AI assistant is negotiating a job for them, in ${LANGUAGE_NAME[lang]}.`,
    "One or two short, plain sentences. Keep every amount exactly as written; add no other number, advice or promise.",
    `Note: ${JSON.stringify(template)}`,
    'Reply with JSON only: {"text": "..."}',
  ].join("\n");
}

/** The text of a model's JSON reply (`{"text": "..."}`), trimmed; undefined for anything else. */
export function replyText(reply: string): string | undefined {
  const object = firstObject(reply);
  if (!object) return undefined;
  try {
    return Reply.safeParse(JSON.parse(object)).data?.text.trim();
  } catch {
    return undefined;
  }
}

export interface ExplainInput {
  facts: readonly Fact[];
  lang: Lang;
  /** The other side as the owner knows them. */
  name: string;
  audience?: Audience;
}

/** Worded notes kept, newest last: far more than one phone's open jobs show at once. */
const KEPT_MAX = 200;
/**
 * Each note as the model worded it, by what it was asked: a job's card is drawn again on every sync and every step,
 * and its notes stay the same, so each is worded once, not on every draw (in the run of all kinds, half of the model's
 * calls reworded a note already worded). Asked twice at once, both wait on the one call. Kept per model, as each
 * model words them its own way.
 */
const wordedBy = new WeakMap<Model, Map<string, Promise<Explanation>>>();

function keep(worded: Map<string, Promise<Explanation>>, key: string, explanation: Promise<Explanation>) {
  worded.set(key, explanation);
  if (worded.size > KEPT_MAX) worded.delete(worded.keys().next().value ?? key);
  // Only the model's words are kept: the template came of no answer in time, and the next draw may get one.
  void explanation.then((e) => {
    if (e.by !== ExplainedBy.model) worded.delete(key);
  });
  return explanation;
}

/**
 * The explanation of one offer: the model's wording when it passes the checker, else the template. For anyone but
 * the owner the limit is left out of the facts and its number is forbidden in the text.
 */
export function explainOffer(model: Model | undefined, i: ExplainInput, waitMs = MODEL_WAIT_MS): Promise<Explanation> {
  const forOwner = (i.audience ?? Audience.owner) === Audience.owner;
  const facts = forOwner ? i.facts : i.facts.filter((f) => f.kind !== FactKind.limit);
  const template = factsText(i.lang, facts, i.name);
  const fallback: Explanation = { text: template, by: ExplainedBy.template };
  if (!model || facts.length === 0) return Promise.resolve(fallback);
  const forbidden = forOwner ? [] : limitRupees(i.facts);
  const key = JSON.stringify([i.lang, template, forbidden]);
  const worded = wordedBy.get(model) ?? new Map<string, Promise<Explanation>>();
  wordedBy.set(model, worded);
  return (
    worded.get(key) ?? keep(worded, key, wordOffer(model, { template, lang: i.lang, forbidden }, fallback, waitMs))
  );
}

/** One call for the model's wording, checked; the template on anything else. */
async function wordOffer(
  model: Model,
  asked: { template: string; lang: Lang; forbidden: readonly number[] },
  fallback: Explanation,
  waitMs: number,
): Promise<Explanation> {
  try {
    const reply = await within(
      model.generate(explainPrompt(asked.template, asked.lang), { maxTokens: MAX_TOKENS, purpose: Purpose.explain }),
      waitMs,
    );
    const text = reply ? replyText(reply) : undefined;
    if (!text || !checkExplanation(text, asked)) return fallback;
    return { text, by: ExplainedBy.model } satisfies Explanation;
  } catch (err) {
    log.warn("explanation failed", { error: (err as Error).name });
    return fallback;
  }
}
