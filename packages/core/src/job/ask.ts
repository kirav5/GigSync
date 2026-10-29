import {
  FREE_QUESTIONS_PROTOCOL,
  MAX_QUESTIONS,
  type Question,
  QuestionKey,
  type StandardQuestion,
  Trade,
} from "@gigsync/protocol";
import { recall, summary } from "../memory/recall.js";
import type { JobContext } from "./context.js";
import { askModel } from "./question-model.js";
import type { JobRecord } from "./store.js";
import type { WorkerRules } from "./worker.js";

const T = Trade.enum;
const Q = QuestionKey.enum;

/**
 * The worker's agent's standard questions, per trade: what it asks when there is no model, the model fails, or the
 * guards drop everything it wrote. Keys only: each phone shows them in its owner's language (`questionText`).
 */
export const QUESTIONS: Readonly<Record<Trade, readonly QuestionKey[]>> = {
  [T.electrician]: [Q.problem],
  [T.plumber]: [Q.problem],
  [T.maid]: [Q.rooms, Q.pets],
  [T.carpenter]: [Q.problem],
  [T.ac_technician]: [Q.problem],
  [T.painter]: [Q.area_sqft],
  [T.cook]: [Q.people, Q.meals, Q.pets],
  [T.driver]: [Q.route],
};

/** A detail one of the worker's own rules reads: the city band's scope rules (price) or their "show me first" list. */
function ruleReads(rules: WorkerRules, trade: Trade, key: QuestionKey): boolean {
  const band = rules.rates?.bands.find((b) => b.trade === trade);
  return Boolean(band?.scope.some((s) => s.key === key) || rules.ask_me?.includes(key));
}

/** True when every phone of the household understands model-written questions; false when unsure. */
async function understands(ctx: JobContext, r: JobRecord): Promise<boolean> {
  try {
    return await ctx.speaks(r.engagement.counterpart, FREE_QUESTIONS_PROTOCOL);
  } catch {
    return false;
  }
}

/**
 * What the worker's agent asks before quoting. With a model, and a household whose phones all read written
 * questions, it asks what the model wrote (after the guards) plus the standard details a rule of the worker's still
 * reads, so the price stays rule-based. Otherwise, or when nothing the model wrote survives, the standard questions
 * for the trade that the household has not answered yet.
 */
export async function questionsFor(ctx: JobContext, rules: WorkerRules, r: JobRecord): Promise<Question[]> {
  const { trade, details, need } = r.request;
  const missing = QUESTIONS[trade].filter((key) => !details[key]);
  const standard: StandardQuestion[] = missing.map((key) => ({ key }));
  if (!ctx.model || !(await understands(ctx, r))) return standard;
  const read = missing.filter((key) => ruleReads(rules, trade, key));
  const counterpart = r.engagement.counterpart;
  const [known, memory] = await Promise.all([recall(ctx, trade, counterpart), summary(ctx, trade, counterpart)]);
  const remembered = Object.keys(known.person?.details ?? {});
  const given = Object.keys(details);
  const knownKeys = QuestionKey.options.filter((k) => [...given, ...remembered, ...read].includes(k));
  const max = MAX_QUESTIONS - read.length;
  const { kept } = await askModel(ctx.model, { trade, need, details, memory, known: knownKeys, max });
  return kept.length === 0 ? standard : [...read.map((key) => ({ key })), ...kept];
}
