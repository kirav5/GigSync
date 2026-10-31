import { Role } from "@gigsync/protocol";
import type { JobContext } from "./context.js";
import { type Mandate, PRICE_STEP_PAISE } from "./negotiate.js";
import type { JobRecord, Need } from "./store.js";
import { drawStrategy, type Strategy, type Tactic } from "./strategy.js";
import { chooseTactic, usualTactic } from "./tactic.js";

/**
 * The household's price plan for one request (ADR 0033): its tactic, read once per need from the owner's own words
 * (never the worker's), and the job's hidden strategy, drawn when the first quote arrives. Each request in a group draws
 * its own, so three workers comparing first offers see three unrelated shares of the budget.
 */

/** The household's opening for a job: the drawn share of its budget, whole ₹10s down, never above the budget. */
export function householdMandate(budget: Mandate, s: Strategy, legal_paise?: number): Mandate {
  const limit = budget.limit_paise;
  const share = Math.floor((limit * s.opening) / PRICE_STEP_PAISE) * PRICE_STEP_PAISE;
  return {
    opening_paise: Math.min(limit, Math.max(PRICE_STEP_PAISE, share)),
    limit_paise: limit,
    ...(legal_paise ? { legal_paise } : {}),
  };
}

/** The need's tactic: kept on the need once chosen, so every request in the group bargains the same way. */
async function tacticFor(ctx: JobContext, need: Need): Promise<Tactic> {
  if (need.tactic) return need.tactic;
  const usual = await usualTactic(ctx.storage);
  const tactic = await chooseTactic(ctx.model, { words: need.need, usual, lang: ctx.lang });
  await ctx.store.saveNeed({ ...need, tactic });
  return tactic;
}

/**
 * The job with its strategy and mandate, drawn the first time the household's agent is about to offer. A job that
 * already made offers on the old fixed curve keeps it, so a negotiation never changes course halfway.
 */
export async function planHousehold(ctx: JobContext, need: Need, r: JobRecord): Promise<JobRecord> {
  if (r.strategy || r.offers_made > 0) return r;
  const strategy = drawStrategy(Role.enum.requester, await tacticFor(ctx, need), ctx.random);
  const mandate = householdMandate(need.budget, strategy, need.estimate?.basis.legal_minimum_paise);
  return { ...r, strategy, mandate };
}
