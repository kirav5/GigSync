import {
  isTrade,
  type JobRequest,
  PAISE_PER_RUPEE,
  type Skill,
  skillKey,
  Trade,
  type WorkRate,
} from "@gigsync/protocol";
import { categoryNamed } from "../skills/suggest.js";
import type { Mandate } from "./negotiate.js";

/**
 * Rates per kind of work (ADR 0062): a worker who repairs fridges and wires houses may charge each differently. The
 * card's own rate is for its first kind; any other kind may have a usual rate of its own (public) and a lowest (on the
 * phone only). A kind without one is at the card's rate, as every card was before.
 */

/** One kind of work on a card, as its rate is kept: a trade by its value, a skill by its key, marked apart. */
export type WorkId = string;
const SKILL_ID = "skill:";

export const tradeWork = (trade: Trade): WorkId => trade;
export const skillWork = (skill: Pick<Skill, "text">): WorkId => `${SKILL_ID}${skillKey(skill.text)}`;

/** A kind of work with a plan of its own: the usual rate and the lowest. */
export interface WorkMandate {
  work: WorkId;
  rate: Mandate;
}

interface CardWork {
  trades?: readonly Trade[] | undefined;
  skills?: readonly Skill[] | undefined;
}

/** The card's kinds of work in its order; the first is the one the card's own rate is for. */
export const cardWorks = (c: CardWork): WorkId[] => [
  ...(c.trades ?? []).map(tradeWork),
  ...(c.skills ?? []).map(skillWork),
];

/** A kind's name to show: a trade's catalog key is the caller's to translate; a skill is in the worker's words. */
export type WorkName = { trade: Trade } | { text: string };

export function workName(c: CardWork, work: WorkId): WorkName | undefined {
  const trade = c.trades?.find((tr) => tradeWork(tr) === work);
  if (trade) return { trade };
  const skill = c.skills?.find((s) => skillWork(s) === work);
  return skill ? { text: skill.text } : undefined;
}

/**
 * The kind on the worker's card a request is for: one of their trades, or a skill on their card by its key (ADR 0047
 * §5) or by its kind (ADR 0059). A household found "TV mechanic" by asking for TV repair: the request names the kind.
 */
export function requestWork(rules: CardWork, req: Pick<JobRequest, "trade" | "skill">): WorkId | undefined {
  if (isTrade(req.trade)) return rules.trades?.includes(req.trade) ? tradeWork(req.trade) : undefined;
  const asked = req.skill;
  if (!asked) return undefined;
  const key = skillKey(asked.text);
  // A request from an app older than kinds of work names the kind only in its words: "Pet care" is pet care.
  const kind = asked.category ?? categoryNamed(asked.text);
  const mine = rules.skills?.find((s) => skillKey(s.text) === key || (kind !== undefined && s.category === kind));
  return mine ? skillWork(mine) : undefined;
}

/** The worker's own plan for the kind a request is for; undefined when that kind is at the card's rate. */
export function workMandate(
  rules: CardWork & { work_rates?: readonly WorkMandate[] | undefined },
  req: Pick<JobRequest, "trade" | "skill">,
): Mandate | undefined {
  const work = requestWork(rules, req);
  return work === undefined ? undefined : rules.work_rates?.find((w) => w.work === work)?.rate;
}

/** A usual rate's lowest at the same share of it as the main plan's, rounded to the rupee (ADR 0046 §2). */
export function atShare(rate_paise: number, main: Mandate): Mandate {
  const share = main.opening_paise > 0 ? main.limit_paise / main.opening_paise : 1;
  return {
    opening_paise: rate_paise,
    limit_paise: Math.round((rate_paise * share) / PAISE_PER_RUPEE) * PAISE_PER_RUPEE,
  };
}

/** The card's rates of its own as the board shows them. */
export function publicWorkRates(rates: readonly WorkMandate[] = []): WorkRate[] {
  return rates.flatMap(({ work, rate }): WorkRate[] => {
    const rate_paise = rate.opening_paise;
    if (work.startsWith(SKILL_ID)) return [{ skill: work.slice(SKILL_ID.length), rate_paise }];
    const trade = Trade.safeParse(work).data;
    return trade ? [{ trade, rate_paise }] : [];
  });
}

/** The id a board's rate of its own is kept under. */
export const workOfRate = (r: WorkRate): WorkId => ("trade" in r ? tradeWork(r.trade) : `${SKILL_ID}${r.skill}`);
