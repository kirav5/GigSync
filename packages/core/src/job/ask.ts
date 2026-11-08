import {
  FREE_QUESTIONS_PROTOCOL,
  isTrade,
  JobTrade,
  Lang,
  MAX_QUESTIONS,
  type Question,
  QuestionKey,
  type Skill,
  type StandardQuestion,
  Trade,
  type UserId,
} from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { recall, summary } from "../memory/recall.js";
import type { JobContext } from "./context.js";
import { askModel, type WorkerContext } from "./question-model.js";
import type { JobRecord } from "./store.js";
import type { WorkerRules } from "./worker.js";

const T = Trade.enum;
const Q = QuestionKey.enum;

/**
 * The worker's agent's standard questions, per trade: what it asks when there is no model, the model fails, or the
 * guards drop everything it wrote. Keys only: each phone shows them in its owner's language (`questionText`).
 */
export const QUESTIONS: Readonly<Record<JobTrade, readonly QuestionKey[]>> = {
  [T.electrician]: [Q.problem],
  [T.plumber]: [Q.problem],
  [T.maid]: [Q.rooms, Q.pets],
  [T.carpenter]: [Q.problem],
  [T.ac_technician]: [Q.problem],
  // Rooms and who buys the paint set the estimate's scope (ADR 0030); a household gives the rooms up front.
  [T.painter]: [Q.rooms, Q.labour_only],
  [T.cook]: [Q.people, Q.meals, Q.pets],
  [T.driver]: [Q.route, Q.hours],
  // ADR 0047: a skill outside the trades has no price drivers, so only what the work is; when and budget are Find's.
  // ADR 0063: never how long it takes, which is the worker's to say, not the household's.
  [JobTrade.enum.other]: [Q.job],
};

/** A detail one of the worker's own rules reads: the city band's scope rules (price) or their "show me first" list. */
function ruleReads(rules: WorkerRules, trade: JobTrade, key: QuestionKey): boolean {
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

/** A kind of work by name for the model: a trade's value, a kind's English name, else the words it was listed in. */
function nameOf(work: { trade?: Trade; skill?: Skill | undefined }): string {
  if (work.trade) return work.trade;
  const category = work.skill?.category;
  return category ? t(Lang.enum.en, `category.${category}`) : (work.skill?.text ?? "");
}

/** Who the worker is for the model (ADR 0063): the work on their card, their line about it, what they need to know. */
export const workerContext = (rules: WorkerRules): WorkerContext => ({
  works: [...rules.trades.map((trade) => nameOf({ trade })), ...(rules.skills ?? []).map((skill) => nameOf({ skill }))],
  ...(rules.about ? { about: rules.about } : {}),
  ...(rules.asks?.length ? { asks: rules.asks } : {}),
});

/** What the agent remembers of this household and this trade; nothing for other work, whose memory has no key yet. */
async function remembered(ctx: JobContext, trade: JobTrade, counterpart: UserId): Promise<[string[], string]> {
  if (!isTrade(trade)) return [[], ""];
  const [known, memory] = await Promise.all([recall(ctx, trade, counterpart), summary(ctx, trade, counterpart)]);
  return [Object.keys(known.person?.details ?? {}), memory];
}

/**
 * What the worker's agent asks before quoting. With a model, and a household whose phones all read written
 * questions, it asks what the model wrote for this worker and this job (after the guards), plus the standard details
 * a rule of the worker's still reads, so the price stays rule-based. Otherwise, or when nothing the model wrote
 * survives, the standard questions for the work that the household has not answered yet. Work outside the trades
 * (ADR 0047) asks the model too, since ADR 0063: its standard question is only what the work is.
 */
export async function questionsFor(ctx: JobContext, rules: WorkerRules, r: JobRecord): Promise<Question[]> {
  const { trade, details, need, skill } = r.request;
  const missing = QUESTIONS[trade].filter((key) => !details[key]);
  const standard: StandardQuestion[] = missing.map((key) => ({ key }));
  if (!ctx.model || !(await understands(ctx, r))) return standard;
  const read = isTrade(trade) ? missing.filter((key) => ruleReads(rules, trade, key)) : [];
  const [recalled, memory] = await remembered(ctx, trade, r.engagement.counterpart);
  const given = Object.keys(details);
  const knownKeys = QuestionKey.options.filter((k) => [...given, ...recalled, ...read].includes(k));
  const max = MAX_QUESTIONS - read.length;
  const work = nameOf(isTrade(trade) ? { trade } : { skill });
  const input = { work, need, details, memory, known: knownKeys, max, worker: workerContext(rules) };
  const { kept } = await askModel(ctx.model, input);
  return kept.length === 0 ? standard : [...read.map((key) => ({ key })), ...kept];
}
